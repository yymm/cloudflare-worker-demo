import { Hono } from "hono";
const app = new Hono();

const imageTag = (img_path: string) => {
  return `<img src="${img_path}" />`;
};

type Metadata = { contentType: string; };

app.get("/image/:id", async (c) => {
  const key = c.req.param("id");

  // check cache
  const kv_cache = await SAMPLE_KV.getWithMetadata<Metadata>(key, {
    type: "arrayBuffer",
  });

  if (kv_cache.value && kv_cache.metadata) {
    const body = kv_cache.value;
    const contentType = kv_cache.metadata.contentType;
    c.header("Content-Type", contentType);
    return c.body(body);
  }

  const object = await BUCKET.get(key);
  if (!object || !object.httpMetadata.contentType) {
    return c.text("Image Not Found", 404);
  }
  const body = await object?.arrayBuffer();
  const contentType = object.httpMetadata.contentType;

  // save cache
  c.event.waitUntil(
    SAMPLE_KV.put(key, body, { metadata: { contentType } })
  );

  c.header("ETag", object.httpEtag);
  c.header("Content-Type", contentType);
  return c.body(body);
});

app.put("/upload/:name", async (c) => {
  const name = c.req.param("name");
  const object = await BUCKET.put(name, c.req.body, { httpMetadata: c.req.headers });
  c.header("ETag", object.httpEtag);
  return c.body(null);
})

app.get("/", async (c) => {
  const list = await BUCKET.list();
  const keys = list.objects.map((headResult) => headResult.key);
  return c.html(keys.map((k) => imageTag(`/image/${k}`)).join(""));
});

app.fire();
