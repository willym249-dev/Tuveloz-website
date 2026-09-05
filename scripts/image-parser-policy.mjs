import { disableTypes } from "image-size";

// vinext 0.0.50 reads local image metadata during builds. image-size 2.0.2
// has no published fix for GHSA-w3rx-r6r6-pgpr / GHSA-5p2g-fcmc-qvqq.
// These formats are not used for site assets; reject them before parsing.
disableTypes(["icns", "heif", "jxl", "jxl-stream"]);
