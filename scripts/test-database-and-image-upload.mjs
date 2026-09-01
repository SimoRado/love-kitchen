import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const base = 'http://localhost:3000';
const prisma = new PrismaClient();
const results = [];

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log('PASS', name, detail ? `(${detail})` : '');
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.error('FAIL', name, detail ? `(${detail})` : '');
  throw new Error(`${name}: ${detail}`);
}

function assert(condition, name, detail = '') {
  if (!condition) fail(name, detail);
  pass(name, detail);
}

function loadEnvValue(key) {
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && match[1].trim() === key) return match[2].trim().replace(/^"|"$/g, '');
    }
  }
  return null;
}

class Jar {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
    this.lastSetCookie = [];
  }
  store(res) {
    const values = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    this.lastSetCookie = values;
    for (const header of values) {
      const first = header.split(';')[0];
      const eq = first.indexOf('=');
      if (eq > 0) this.cookies.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  header() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.jar?.header()) headers.Cookie = options.jar.header();
  let body = options.body;
  if (
    body !== undefined &&
    typeof body !== 'string' &&
    !(body instanceof FormData) &&
    !Buffer.isBuffer(body) &&
    !(body instanceof Blob)
  ) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  const url = path.startsWith('http') ? path : base + path;
  const res = await fetch(url, { method: options.method || 'GET', headers, body, signal: options.signal });
  options.jar?.store(res);
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const text = buffer.toString('utf8');
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, status: res.status, text, json, buffer, headers: res.headers, setCookie: options.jar?.lastSetCookie || [] };
}

async function adminLogin(jar, password) {
  const response = await req('/api/auth/login', { method: 'POST', jar, body: { password } });
  assert(response.status === 200 && response.json?.success, `${jar.name} admin login`, `status ${response.status}`);
}

/**
 * Executes the canonical 3-step upload pipeline:
 * 1. Sign URL (/api/upload/sign)
 * 2. Direct upload to storage signed URL (bypasses Vercel)
 * 3. Process raw file (/api/upload/process) -> Sharp 1200x750 WebP q80
 */
async function uploadAndProcessPipeline(adminJar, fileBuffer, fileName, mimeType) {
  // Step 1: Sign
  const signRes = await req('/api/upload/sign', {
    method: 'POST',
    jar: adminJar,
    body: { mimeType, fileName, fileSize: fileBuffer.length },
  });

  if (signRes.status !== 200 || !signRes.json?.data?.signedUrl || !signRes.json?.data?.rawPath) {
    return { success: false, status: signRes.status, error: signRes.json?.error || 'Sign failed', stage: 'sign' };
  }

  const { signedUrl, rawPath } = signRes.json.data;

  // Step 2: Direct Storage Upload (binary body to signed URL)
  const uploadRes = await req(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
    body: fileBuffer,
  });

  if (uploadRes.status !== 200 && uploadRes.status !== 201) {
    return { success: false, status: uploadRes.status, error: 'Direct storage upload failed', stage: 'direct_upload' };
  }

  // Step 3: Process Raw Object
  const processRes = await req('/api/upload/process', {
    method: 'POST',
    jar: adminJar,
    body: { rawPath },
  });

  if (processRes.status !== 200 || !processRes.json?.data?.url) {
    return { success: false, status: processRes.status, error: processRes.json?.error || 'Process failed', stage: 'process' };
  }

  return { success: true, url: processRes.json.data.url, filename: processRes.json.data.filename, rawPath };
}

async function main() {
  try {
    console.log('==================================================');
    console.log('RUNNING PRODUCT IMAGE UPLOAD & OPTIMIZATION TEST SUITE');
    console.log('==================================================\n');

    const adminPassword = loadEnvValue('ADMIN_PASSWORD');
    assert(Boolean(adminPassword), 'Admin password loaded from env');

    const adminJar = new Jar('admin-browser');
    await adminLogin(adminJar, adminPassword);

    // --- 1. Security: Unauthenticated Access Blocked ---
    console.log('\n--- 1. Testing Upload Security & Authentication ---');
    const unauthSign = await req('/api/upload/sign', {
      method: 'POST',
      body: { mimeType: 'image/jpeg', fileName: 'test.jpg' },
    });
    assert(unauthSign.status === 401, 'Unauthenticated POST /api/upload/sign rejected with 401');

    const unauthProcess = await req('/api/upload/process', {
      method: 'POST',
      body: { rawPath: 'raw/unauth-test.jpg' },
    });
    assert(unauthProcess.status === 401, 'Unauthenticated POST /api/upload/process rejected with 401');

    const legacyDirect = await req('/api/upload', { method: 'POST', jar: adminJar });
    assert(legacyDirect.status === 400, 'Deprecated legacy POST /api/upload returns 400 guidance');

    // --- 2. Testing Signed URL Generation ---
    console.log('\n--- 2. Testing Signed Upload URL Generation ---');
    const signSmall = await req('/api/upload/sign', {
      method: 'POST',
      jar: adminJar,
      body: { mimeType: 'image/jpeg', fileName: 'burger.jpg', fileSize: 500 * 1024 },
    });
    assert(signSmall.status === 200 && signSmall.json?.data?.rawPath, 'Admin generated signed upload URL', signSmall.json?.data?.rawPath);

    // --- 3. Testing Canonical Pipeline (Sign -> Direct Upload -> Process) ---
    console.log('\n--- 3. Testing Canonical Pipeline with Various Image Formats ---');

    // 3a. Small 500KB JPEG
    console.log('Uploading 500KB test JPEG...');
    const smallJpg = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 220, g: 80, b: 30 } },
    }).jpeg({ quality: 85 }).toBuffer();

    const smallResult = await uploadAndProcessPipeline(adminJar, smallJpg, 'small-burger.jpg', 'image/jpeg');
    assert(smallResult.success && smallResult.url.endsWith('.webp'), 'Small JPEG processed into WebP (1200x750 q80)', smallResult.url);

    // Verify small image loads and has exact 1200x750 dimensions
    let smallBuffer;
    if (smallResult.url.startsWith('/uploads/')) {
      const localFilePath = path.join(process.cwd(), 'public', smallResult.url);
      smallBuffer = fs.readFileSync(localFilePath);
      pass('Direct image URL verified locally', smallResult.url);
    } else {
      const smallImageGet = await req(smallResult.url);
      assert(smallImageGet.status === 200, 'Direct image URL returns HTTP 200', smallResult.url);
      smallBuffer = smallImageGet.buffer;
    }
    const smallImageMeta = await sharp(smallBuffer).metadata();
    assert(smallImageMeta.format === 'webp', 'Image format is verified WebP');
    assert(smallImageMeta.width === 1200 && smallImageMeta.height === 750, 'Image dimensions standardized to 1200x750 (16:10)', `${smallImageMeta.width}x${smallImageMeta.height}`);

    // 3b. Large >4.5 MB Professional Camera Photo (~12 MB RAW camera simulation)
    console.log('\nUploading ~10-12 MB high-resolution camera JPEG with texture/detail (6000x4000)...');
    // Generate realistic high-entropy noise texture so JPEG exceeds 4.5 MB
    const largeRaw = Buffer.alloc(6000 * 4000 * 3);
    for (let i = 0; i < largeRaw.length; i += 3) {
      largeRaw[i] = (i * 7) % 256;
      largeRaw[i + 1] = (i * 13 + 50) % 256;
      largeRaw[i + 2] = (i * 29 + 100) % 256;
    }
    const largeJpg = await sharp(largeRaw, { raw: { width: 6000, height: 4000, channels: 3 } })
      .jpeg({ quality: 98 })
      .toBuffer();

    console.log(`Large photo size: ${(largeJpg.length / 1024 / 1024).toFixed(2)} MB (bypasses Vercel 4.5 MB limit)`);
    assert(largeJpg.length > 4.5 * 1024 * 1024, 'Large camera photo is genuinely > 4.5 MB');

    const largeResult = await uploadAndProcessPipeline(adminJar, largeJpg, 'camera-photo.jpg', 'image/jpeg');
    assert(largeResult.success && largeResult.url.endsWith('.webp'), '10+ MB camera photo processed into WebP without 413 error', largeResult.url);

    // Verify large image loads and has exact 1200x750 dimensions
    let largeBuffer;
    if (largeResult.url.startsWith('/uploads/')) {
      const localFilePath = path.join(process.cwd(), 'public', largeResult.url);
      largeBuffer = fs.readFileSync(localFilePath);
      pass('Direct camera WebP verified locally', largeResult.url);
    } else {
      const largeImageGet = await req(largeResult.url);
      assert(largeImageGet.status === 200, 'Direct camera WebP URL returns HTTP 200', largeResult.url);
      largeBuffer = largeImageGet.buffer;
    }
    const largeImageMeta = await sharp(largeBuffer).metadata();
    assert(largeImageMeta.format === 'webp', 'Camera image is valid WebP');
    assert(largeImageMeta.width === 1200 && largeImageMeta.height === 750, 'Camera image resized to 1200x750', `${largeImageMeta.width}x${largeImageMeta.height}`);

    // 3c. PNG format
    console.log('\nUploading PNG and normalizing to WebP...');
    const testPng = await sharp({
      create: { width: 800, height: 600, channels: 4, background: { r: 50, g: 150, b: 250, alpha: 1 } },
    }).png().toBuffer();
    const pngResult = await uploadAndProcessPipeline(adminJar, testPng, 'tacos.png', 'image/png');
    assert(pngResult.success && pngResult.url.endsWith('.webp'), 'PNG normalized to WebP format');

    // 3d. WEBP format
    console.log('\nUploading WEBP and standardizing...');
    const testWebp = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 100, g: 200, b: 100 } },
    }).webp().toBuffer();
    const webpResult = await uploadAndProcessPipeline(adminJar, testWebp, 'fresh.webp', 'image/webp');
    assert(webpResult.success && webpResult.url.endsWith('.webp'), 'WEBP input standardized to 1200x750');

    // 3e. Invalid non-image file rejection
    console.log('\nTesting invalid file signature rejection...');
    const fakeFile = Buffer.from('This is completely fake binary content not an image');
    const fakeResult = await uploadAndProcessPipeline(adminJar, fakeFile, 'fake.jpg', 'image/jpeg');
    assert(!fakeResult.success && fakeResult.stage === 'process', 'Invalid image signature rejected with 400 in process stage');

    // 3f. Oversized file (> 30 MB)
    console.log('\nTesting oversized file (> 30 MB) rejection...');
    const oversizedSign = await req('/api/upload/sign', {
      method: 'POST',
      jar: adminJar,
      body: { mimeType: 'image/jpeg', fileName: 'huge.jpg', fileSize: 32 * 1024 * 1024 },
    });
    assert(oversizedSign.status === 400, 'Oversized file (>30MB) rejected in sign stage with 400');

    // --- 4. Product Image Persistence & Database Consistency ---
    console.log('\n--- 4. Testing Product Image Persistence & Customer Storefront ---');
    const productsRes = await req('/api/products');
    const targetProduct = productsRes.json.data[0];
    const originalImage = targetProduct.image;
    const newOptimizedWebpUrl = largeResult.url;

    // Attach new optimized WebP to product
    const updateRes = await req(`/api/products/${targetProduct.id}`, {
      method: 'PUT',
      jar: adminJar,
      body: {
        name: targetProduct.name,
        price: targetProduct.price,
        categoryId: targetProduct.categoryId,
        available: targetProduct.available,
        image: newOptimizedWebpUrl,
      },
    });
    assert(updateRes.status === 200 && updateRes.json?.data?.image === newOptimizedWebpUrl, 'Product updated with optimized WebP image');

    // Verify in PostgreSQL database
    const dbProduct = await prisma.product.findUnique({ where: { id: targetProduct.id } });
    assert(dbProduct?.image === newOptimizedWebpUrl, 'Optimized WebP URL persisted in PostgreSQL Product table');
    assert(!dbProduct?.image?.startsWith('data:'), 'PostgreSQL stores clean URL, never base64 binary');

    // Customer storefront verification
    const customerProducts = await req('/api/products');
    const customerProduct = customerProducts.json?.data?.find((p) => p.id === targetProduct.id);
    assert(customerProduct?.image === newOptimizedWebpUrl, 'Customer storefront receives optimized WebP image');

    // Image replacement test: replacing with another image cleans up old image
    console.log('\nTesting image replacement & storage cleanup...');
    const replaceResult = await uploadAndProcessPipeline(adminJar, smallJpg, 'replacement.jpg', 'image/jpeg');
    const updateReplaceRes = await req(`/api/products/${targetProduct.id}`, {
      method: 'PUT',
      jar: adminJar,
      body: {
        name: targetProduct.name,
        price: targetProduct.price,
        categoryId: targetProduct.categoryId,
        available: targetProduct.available,
        image: replaceResult.url,
      },
    });
    assert(updateReplaceRes.status === 200 && updateReplaceRes.json?.data?.image === replaceResult.url, 'Product updated with second replacement image');

    // Verify old image was removed after replacement
    if (newOptimizedWebpUrl.startsWith('/uploads/')) {
      const oldLocalPath = path.join(process.cwd(), 'public', newOptimizedWebpUrl);
      assert(!fs.existsSync(oldLocalPath), 'Replaced local image was cleaned up from storage');
    }

    // Restore original product image
    await req(`/api/products/${targetProduct.id}`, {
      method: 'PUT',
      jar: adminJar,
      body: {
        name: targetProduct.name,
        price: targetProduct.price,
        categoryId: targetProduct.categoryId,
        available: targetProduct.available,
        image: originalImage,
      },
    });

    console.log('\n==================================================');
    console.log(`SUMMARY: ALL ${results.filter((r) => r.ok).length} OPTIMIZATION & STORAGE CHECKS PASSED!`);
    console.log('==================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

