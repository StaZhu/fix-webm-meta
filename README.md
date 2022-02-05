# fix-webm-metainfo

This is a lib based on ts-ebml and support large file (>2GB) that ts-ebml not supported

Using this function can not only add "Duration" but also add "SeekHead", "Seek", "SeekID", "SeekPosition" and "Cues", "CueTime", "CueTrack", "CueClusterPosition", "CueTrackPositions", "CuePoint" for a webm file
## Usage

```typescript
import fixWebmMetaInfo from 'fix-webm-metainfo';

// please use h264 to enable hardware encode accelerate and decrease cpu usage
const mimeType = 'video/webm\;codecs=h264';
const blobSlice: BlobPart[] = [];

mediaRecorder = new MediaRecorder(stream, {
  mimeType,
  videoBitsPerSecond: 1e6
});

mediaRecorder.ondataavailable = (event: BlobEvent) => {
  blobSlice.push(event.data);
}

mediaRecorder.onstop = async () => {
  // support fix webm files larger than 2GB
  const fixedWebMBlob = await fixWebmMetaInfo(new Blob([...blobSlice], { type: mimeType }));
  blobSlice = [];
};

// using timeslice to avoid memory consumption in renderer process, and generate blob size each second
mediaRecorder.start(1000);
setTimeout(() => mediaRecorder.stop(), 5000); // generate 5 blob slices

```

## Release Note

```
v1.0.6:
fix: using Blob instead of arrayBuffer to fix recreate webm and solving memory leak

v1.0.5
feat: initial commit
```

## Tips for using this library

##### Does this library has memory leak (both in main process and renderer process) ?

Currently each record will have a maxiumm 5MB memory leak (already the best result, because chromium interal blob <-> arrayBuffer process has some kind of bug, and we have to regenerate webm meta head), if you have the ability to modify chromium, this value can decrease down to  1MB or even much smaller size.

##### How to decrease memory leak(decrease page size)?

The only way is to modify chromium project, here is the example:

```c++
// storage/browser/blob/blob_storage_constants.cc
#if defined(OS_ANDROID)
// On minimal Android maximum in-memory space can be as low as 5MB.
constexpr uint64_t kDefaultMinPageFileSize = 5ull * 1024 * 1024 / 2;
const float kDefaultMaxBlobInMemorySpaceUnderPressureRatio = 0.02f;
#else
// fix1: change 5MB minPageSize to 1MB
constexpr uint64_t kDefaultMinPageFileSize = 1ull * 1024 * 1024;
const float kDefaultMaxBlobInMemorySpaceUnderPressureRatio = 0.002f;
#endif
```

##### What is the maximum record file size?

According to the chromium blob implention, this value equals to Math.min(software located disk partition size * / 10, free disk space), so if your C:\ partition is 128GB, the max record size is 12.8GB, even if you have 100GB free space.

##### how to get rid of the limit of record file size?

The only why is modify chromium project, here is the example:

```c++
// storage/browser/blob/blob_memory_controller.cc
if (disk_size >= 0) {
#if defined(OS_CHROMEOS)
  limits.desired_max_disk_space = static_cast<uint64_t>(disk_size / 2ll);
#elif defined(OS_ANDROID)
  limits.desired_max_disk_space = static_cast<uint64_t>(3ll * disk_size / 50);
#else
  // fix2: make file limit from 1/10 disk size to 1/1
  limits.desired_max_disk_space = static_cast<uint64_t>(disk_size);
#endif
}
```

##### Why timeslice will reduce memory usage?

Because Blob creation has a Renderer -> Main -> Memory/Disk Transport process, and if no mediaRecord.RequestData() called or timeslice specified, then all data will be buffered in the renderer process, we have to clear the data in memory.

##### What Video record tooks me 2GB（x64) in main process?

Because Blob designed to be store in sharedMemory initially, and if the memory is not enough to store, it will use disk space to store blob afterward.

##### how can i not use memory and directly store blob to disk?

The only way is to modify chromium project, here is the example:

```c++
// storage/browser/blob/blob_memory_controller.cc
if (memory_size > 0) {
#if !defined(OS_CHROMEOS) && !defined(OS_ANDROID)
  // fix3: make 2GB -> 200MB to decrease main process memory usage
  constexpr size_t kTwoHundrendMegabytes = 2ull * 100 * 1024 * 1024;
  limits.max_blob_in_memory_space = kTwoHundrendMegabytes;
#elif defined(OS_ANDROID)
  limits.max_blob_in_memory_space = static_cast<size_t>(memory_size / 100ll);
#else
  limits.max_blob_in_memory_space = static_cast<size_t>(memory_size / 5ll);
#endif
}
```

## What is the current limit of this library
1. using web worker to decrease thread crimp (already implement, will suport later)
2. decrease runtime fix memory consumption
3. support non-node enviroment fixup
