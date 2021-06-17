import { tools, Reader } from 'ts-ebml';
import LargeFileDecorder from './decoder';

/**
 * fix webm file media file without 2GB filesize limit
 * 
 * @param blob the blob you need to fix
 * @returns the blob that has been fixed
 * 
 * use this function can not only add "Duration" but also add "SeekHead", "Seek", "SeekID", "SeekPosition" for the webm
 * if a webm loss "SeekHead", "Seek", "SeekID", "SeekPosition" and "Cues", "CueTime", "CueTrack", "CueClusterPosition", "CueTrackPositions", "CuePoint",  
 * then the webm will not seekable when playing in chrome with builtin <video> tag
 * that means only when all webm is donwloaded then user can seek location
 * now with the help of ts-ebml library, this issue solved by recalculate metadata
 * however ts-ebml doesn't support large file larger than 2 GB
 *
 */
export default async function fixWebmMetaInfo(blob: Blob): Promise<Blob> {
  const decoder = new LargeFileDecorder();
  const reader = new Reader();
  reader.logging = false;

  const bufSlices: ArrayBuffer[] = [];
  // 1GB slice is good, but dont set this value larger than 2046 * 1024 * 1024 due to new Uint8Array's limit
  const sliceLength = 1 * 1024 * 1024 * 1024;
  for (let i = 0; i < blob.size; i = i + sliceLength) {
    const bufSlice = await blob.slice(i, Math.min(i + sliceLength, blob.size)).arrayBuffer();
    bufSlices.push(bufSlice);
  }

  decoder.decode(bufSlices).forEach(elm => reader.read(elm));
  reader.stop();

  const refinedMetadataBuf = tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);

  const firstPartSlice = bufSlices.shift() as ArrayBuffer;
  const firstPartSliceWithoutMetadata = firstPartSlice.slice(reader.metadataSize);

  return new Blob([refinedMetadataBuf, firstPartSliceWithoutMetadata, ...bufSlices], { type: blob.type });
}