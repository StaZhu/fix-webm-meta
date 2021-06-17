import EBML from 'ts-ebml';
export default class EBMLDecoder {
    private _bufferChunks;
    private _tag_stack;
    private _state;
    private _cursor;
    private _total;
    private _schema;
    private _result;
    private get _bufferLength();
    private _sliceChunks;
    decode(chunks: ArrayBuffer[]): EBML.EBMLElementDetail[];
    private readChunk;
    private getSchemaInfo;
    private readTag;
    private readSize;
    private readContent;
}
