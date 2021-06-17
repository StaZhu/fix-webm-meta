# fix-webm-metainfo

This is a lib based on ts-ebml and support large file (>2GB) which ts-ebml not supported

Use this function can not only add "Duration" but also add "SeekHead", "Seek", "SeekID", "SeekPosition" and "Cues", "CueTime", "CueTrack", "CueClusterPosition", "CueTrackPositions", "CuePoint" for a webm file

## Usage

```typescript
import fixWebmMetaInfo from 'fix-webm-metainfo';

const mimeType = 'video/webm\;codecs=vp9';

mediaRecorder = new MediaRecorder(stream, {
  mimeType,
  videoBitsPerSecond: 1000000
});

mediaRecorder.ondataavailable = async (event: BlobEvent) => {
  // support webm file larger than 2GB
  const fixedWebMBlob = await fixWebmMetaInfo(new Blob([event.data], { type: mimeType }));
};

mediaRecorder.start();
setTimeout(() => mediaRecorder.stop(), 5000);
```

## License

GPL General Public License 3.0 see http://www.gnu.org/licenses/gpl-3.0.html