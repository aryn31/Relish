import multer from "multer";
/** Multipart uploads (menu photos, UPI QR): kept in memory, max 5 MB per file.
 *  Use as route middleware, e.g. `router.post("/admin/upi", upload.single("upi"), handler)`, then `saveUpload(req.file)`. */
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
