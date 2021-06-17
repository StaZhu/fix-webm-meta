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
export default function fixWebmMetaInfo(blob: Blob): Promise<Blob>;
