let _app;

export default async function handler(req, res) {
  if (!_app) {
    const mod = await import("./dist/vercel.mjs");
    _app = mod.default;
  }
  _app(req, res);
}
