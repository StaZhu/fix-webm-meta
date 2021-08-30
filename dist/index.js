"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts_ebml_1 = require("ts-ebml");
const decoder_1 = __importDefault(require("./decoder"));
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
function fixWebmMetaInfo(blob) {
    return __awaiter(this, void 0, void 0, function* () {
        const decoder = new decoder_1.default();
        const reader = new ts_ebml_1.Reader();
        reader.logging = false;
        let bufSlices = [];
        let blobSlices = [];
        // 1GB slice is good, but dont set this value larger than 2046 * 1024 * 1024 due to new Uint8Array's limit
        const sliceLength = 1 * 1024 * 1024 * 1024;
        for (let i = 0; i < blob.size; i = i + sliceLength) {
            const slice = blob.slice(i, Math.min(i + sliceLength, blob.size));
            const bufSlice = yield slice.arrayBuffer();
            bufSlices.push(bufSlice);
            blobSlices.push(slice);
        }
        decoder.decode(bufSlices).forEach(elm => reader.read(elm));
        reader.stop();
        const refinedMetadataBuf = ts_ebml_1.tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);
        const refinedMetadataBlob = new Blob([refinedMetadataBuf], { type: blob.type });
        const firstPartBlobSlice = blobSlices.shift();
        const firstPartBlobWithoutMetadata = firstPartBlobSlice.slice(reader.metadataSize);
        // use blob instead of arrayBuffer to construct the new Blob, to minify memory leak
        const finalBlob = new Blob([refinedMetadataBlob, firstPartBlobWithoutMetadata, ...blobSlices], { type: blob.type });
        bufSlices = [];
        blobSlices = [];
        return finalBlob;
    });
}
exports.default = fixWebmMetaInfo;
//# sourceMappingURL=index.js.map