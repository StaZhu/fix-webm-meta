import EBML, { tools } from 'ts-ebml';
import { Int64BE } from 'int64-buffer';
import { Buffer } from 'buffer/'
import schema from './matroska-schema';

enum State {
  STATE_TAG = 1,
  STATE_SIZE = 2,
  STATE_CONTENT = 3
}

export default class EBMLDecoder {
  private _bufferChunks: Buffer[] = [];
  private _tag_stack: EBML.EBMLElementDetail[] = [];
  private _state: State = State.STATE_TAG;
  private _cursor = 0;
  private _total = 0;
  private _schema: Record<number, EBML.Schema> = schema.byEbmlID as unknown as Record<number, EBML.Schema>;
  private _result: EBML.EBMLElementDetail[] = [];

  private get _bufferLength(): number {
    return this._bufferChunks.reduce((prev, current) => prev + current.length, 0);
  }

  private _sliceChunks(begin?: number, end?: number): Buffer[] {
    const slicedChunks: Buffer[] = [];
    let offsetStart = 0;
    begin = begin || 0;
    end = end || this._bufferLength;
    if (begin < 0 || end < 0) {
      throw new Error('begin or end cant be lower than zero');
    }
    if (end < begin) {
      throw new Error('end  cant be lower than begin');
    }
    for (let i = 0; i < this._bufferChunks.length; i++) {
      const chunkSize = this._bufferChunks[i].length;

      if (begin >= offsetStart + chunkSize) {
        offsetStart = offsetStart + chunkSize;
        continue;
      }

      if (end <= offsetStart) {
        break;
      }
      
      const _start = Math.max(begin - offsetStart, 0);
      const _stop = Math.min(chunkSize, end - offsetStart);
      if (_start === 0 && _stop === chunkSize) {
        slicedChunks.push(this._bufferChunks[i]);
      } else {
        slicedChunks.push(this._bufferChunks[i].slice(_start, _stop));
      }
      
      offsetStart = offsetStart + chunkSize;
    }
    return slicedChunks;
  }

  decode(chunks: ArrayBuffer[]): EBML.EBMLElementDetail[] {
    this.readChunk(chunks);
    const diff = this._result;
    this._result = [];
    return diff;
  }

  private readChunk(chunks: ArrayBuffer[]): void {
    this._bufferChunks = chunks.map(c => new Buffer(c));
    while (this._cursor < this._bufferLength) {
      if (this._state === State.STATE_TAG && !this.readTag()) {
        break;
      }
      if (this._state === State.STATE_SIZE && !this.readSize()) {
        break;
      }
      if (this._state === State.STATE_CONTENT && !this.readContent()) {
        break;
      }
    }
  }

  private getSchemaInfo(tagNum: number): EBML.Schema {
    return (
      this._schema[tagNum] || {
        name: 'unknown',
        level: -1,
        type: 'unknown',
        description: 'unknown',
      }
    );
  }

  private readTag(): boolean {
    if (this._cursor >= this._bufferLength) {
      return false;
    }

    const tag = tools.readVint(this._bufferChunks[0], this._cursor);
    if (tag === null) {
      return false;
    }

    const buf = tools.concat(this._sliceChunks(this._cursor, this._cursor + tag.length)) as Buffer;
    const tagNum = buf.reduce((o, v, i, arr) => o + v * Math.pow(16, 2 * (arr.length - 1 - i)), 0);

    const schema = this.getSchemaInfo(tagNum);

    const tagObj: EBML.EBMLElementDetail = {
      EBML_ID: tagNum.toString(16),
      schema,
      type: schema.type,
      name: schema.name,
      level: schema.level,
      tagStart: this._total,
      tagEnd: this._total + tag.length,
      sizeStart: this._total + tag.length,
      sizeEnd: null,
      dataStart: null,
      dataEnd: null,
      dataSize: null,
      data: null,
    } as any;

    this._tag_stack.push(tagObj);

    this._cursor += tag.length;
    this._total += tag.length;

    this._state = State.STATE_SIZE;

    return true;
  }

  private readSize(): boolean {
    if (this._cursor >= this._bufferLength) {
      return false;
    }

    const size = tools.readVint(this._bufferChunks[0], this._cursor);

    if (size === null) {
      return false;
    }

    const tagObj = this._tag_stack[this._tag_stack.length - 1];

    tagObj.sizeEnd = tagObj.sizeStart + size.length;

    tagObj.dataStart = tagObj.sizeEnd;

    tagObj.dataSize = size.value;

    if (size.value === -1) {
      tagObj.dataEnd = -1;
      if (tagObj.type === 'm') {
        tagObj.unknownSize = true;
      }
    } else {
      tagObj.dataEnd = tagObj.sizeEnd + size.value;
    }

    this._cursor += size.length;
    this._total += size.length;

    this._state = State.STATE_CONTENT;

    return true;
  }

  private readContent(): boolean {
    const tagObj = this._tag_stack[this._tag_stack.length - 1];

    if (tagObj.type === 'm') {
      tagObj.isEnd = false;
      this._result.push(tagObj);
      this._state = State.STATE_TAG;
      if (tagObj.dataSize === 0) {
        const elm = Object.assign({}, tagObj, { isEnd: true });
        this._result.push(elm);
        this._tag_stack.pop();
      }
      return true;
    }

    if (this._bufferLength < this._cursor + tagObj.dataSize) {
      return false;
    }

    const data = tools.concat(this._sliceChunks(this._cursor, this._cursor + tagObj.dataSize));

    this._bufferChunks = this._sliceChunks(this._cursor + tagObj.dataSize);

    tagObj.data = data;

    switch (tagObj.type) {
      case 'u':
        tagObj.value = data.readUIntBE(0, data.length);
        break;
      case 'i':
        tagObj.value = data.readIntBE(0, data.length);
        break;
      case 'f':
        tagObj.value =
          tagObj.dataSize === 4 ?
            data.readFloatBE(0) :
            tagObj.dataSize === 8 ?
              data.readDoubleBE(0) :
              (console.warn(`cannot read ${tagObj.dataSize} octets float. failback to 0`), 0);
        break;
      case 's':
        tagObj.value = data.toString('ascii');
        break;
      case '8':
        tagObj.value = data.toString('utf8');
        break;
      case 'b':
        tagObj.value = data;
        break;
      case 'd':
        tagObj.value = tools.convertEBMLDateToJSDate(new Int64BE(data).toNumber());
        break;
      default:
        break;
    }
    if (tagObj.value === null) {
      throw new Error(`unknown tag type:${tagObj.type}`);
    }
    this._result.push(tagObj);

    this._total += tagObj.dataSize;

    this._state = State.STATE_TAG;
    this._cursor = 0;
    this._tag_stack.pop();

    while (this._tag_stack.length > 0) {
      const topEle = this._tag_stack[this._tag_stack.length - 1];
      if (topEle.dataEnd < 0) {
        this._tag_stack.pop();
        return true;
      }
      if (this._total < topEle.dataEnd) {
        break;
      }
      if (topEle.type !== 'm') {
        throw new Error('parent element is not master element');
      }
      const elm = Object.assign({}, topEle, { isEnd: true });
      this._result.push(elm);
      this._tag_stack.pop();
    }

    return true;
  }
}
