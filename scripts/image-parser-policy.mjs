import { disableTypes } from "image-size";

// vinext 0.0.50 reads local image metadata during builds. Keep its image-size
// dependency patched through package.json's shared override. These formats
// are not used for site assets; retain the restriction as defense in depth.
disableTypes(["icns", "heif", "jxl", "jxl-stream"]);
