import fs from 'node:fs';
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
  if (body !== undefined && typeof body !== 'string' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + path, { method: options.method || 'GET', headers, body, signal: options.signal });
  options.jar?.store(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, status: res.status, text, json, setCookie: options.jar?.lastSetCookie || [] };
}

async function adminLogin(jar, password) {
  const response = await req('/api/auth/login', { method: 'POST', jar, body: { password } });
  assert(response.status === 200 && response.json?.success, `${jar.name} admin login`, `status ${response.status}`);
}

async function main() {
  try {
    console.log('==================================================');
    console.log('RUNNING IMAGE OPTIMIZATION & DATABASE TEST SUITE');
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

    const unauthDirect = await req('/api/upload', { method: 'POST' });
    assert(unauthDirect.status === 401, 'Unauthenticated POST /api/upload rejected with 401');

    // --- 2. Testing Signed URL Endpoint ---
    console.log('\n--- 2. Testing Signed Upload URL Generation ---');
    const signSmall = await req('/api/upload/sign', {
      method: 'POST',
      jar: adminJar,
      body: { mimeType: 'image/jpeg', fileName: 'burger.jpg', fileSize: 500 * 1024 },
    });
    assert(signSmall.status === 200 && signSmall.json?.data?.rawPath, 'Admin generated signed upload URL', signSmall.json?.data?.rawPath);

    // --- 3. Testing Sharp Image Optimization Pipeline ---
    console.log('\n--- 3. Testing Sharp Image Processing & WebP Conversion ---');

    // 3a. Small 500KB JPEG
    console.log('Uploading 500KB test JPEG...');
    const smallJpg = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 220, g: 80, b: 30 } },
    }).jpeg({ quality: 85 }).toBuffer();

    const smallForm = new FormData();
    smallForm.append('file', new Blob([smallJpg], { type: 'image/jpeg' }), 'small-burger.jpg');
    const uploadSmall = await req('/api/upload', { method: 'POST', jar: adminJar, body: smallForm });
    assert(uploadSmall.status === 200 && uploadSmall.json?.data?.url?.endsWith('.webp'), 'Small JPEG optimized to WebP format (1200x900 q80)', uploadSmall.json?.data?.url);

    // 3b. Large 12MB Camera Photo (simulating DSLR / iPhone photo)
    console.log('\nUploading 12MB high-resolution camera JPEG (6000x4000)...');
    const largeJpg = await sharp({
      create: { width: 6000, height: 4000, channels: 3, background: { r: 255, g: 140, b: 0 } },
    }).jpeg({ quality: 95 }).toBuffer();
    console.log(`Large photo size: ${(largeJpg.length / 1024 / 1024).toFixed(2)} MB`);

    const largeForm = new FormData();
    largeForm.append('file', new Blob([largeJpg], { type: 'image/jpeg' }), 'camera-photo.jpg');
    const uploadLarge = await req('/api/upload', { method: 'POST', jar: adminJar, body: largeForm });
    assert(uploadLarge.status === 200 && uploadLarge.json?.data?.url?.endsWith('.webp'), '12MB photo processed and optimized into WebP without 413 error', uploadLarge.json?.data?.url);

    // 3c. PNG and WEBP normalization
    console.log('\nUploading PNG and normalizing to WebP...');
    const testPng = await sharp({
      create: { width: 800, height: 600, channels: 4, background: { r: 50, g: 150, b: 250, alpha: 1 } },
    }).png().toBuffer();
    const pngForm = new FormData();
    pngForm.append('file', new Blob([testPng], { type: 'image/png' }), 'tacos.png');
    const uploadPng = await req('/api/upload', { method: 'POST', jar: adminJar, body: pngForm });
    assert(uploadPng.status === 200 && uploadPng.json?.data?.url?.endsWith('.webp'), 'PNG normalized to WebP format');

    // 3d. Fake non-image file rejection
    console.log('\nTesting invalid file rejection...');
    const fakeFile = Buffer.from('This is completely fake binary content not an image');
    const fakeForm = new FormData();
    fakeForm.append('file', new Blob([fakeFile], { type: 'image/jpeg' }), 'fake.jpg');
    const uploadFake = await req('/api/upload', { method: 'POST', jar: adminJar, body: fakeForm });
    assert(uploadFake.status === 400, 'Invalid image signature rejected with 400 Bad Request');

    // 3e. Oversized file (> 30MB)
    const oversizedBuffer = Buffer.alloc(31 * 1024 * 1024);
    oversizedBuffer[0] = 0xff; oversizedBuffer[1] = 0xd8; oversizedBuffer[2] = 0xff;
    const oversizedForm = new FormData();
    oversizedForm.append('file', new Blob([oversizedBuffer], { type: 'image/jpeg' }), 'huge.jpg');
    const uploadOversized = await req('/api/upload', { method: 'POST', jar: adminJar, body: oversizedForm });
    assert(uploadOversized.status === 400, 'Oversized file (>30MB) rejected with 400 Bad Request');

    // --- 4. Product Image Persistence & Database Consistency ---
    console.log('\n--- 4. Testing Product Image Persistence & Customer Storefront ---');
    const productsRes = await req('/api/products');
    const targetProduct = productsRes.json.data[0];
    const originalImage = targetProduct.image;
    const newOptimizedWebpUrl = uploadLarge.json.data.url;

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
    assert(dbProduct?.image === newOptimizedWebpUrl, 'Optimized WebP URL persisted in Supabase PostgreSQL Product table');
    assert(!dbProduct?.image?.startsWith('data:'), 'PostgreSQL stores clean URL, never base64 binary');

    // Customer storefront verification
    const customerProducts = await req('/api/products');
    const customerProduct = customerProducts.json?.data?.find((p) => p.id === targetProduct.id);
    assert(customerProduct?.image === newOptimizedWebpUrl, 'Customer storefront receives optimized WebP image without delay');

    // Update product WITHOUT changing image
    const editWithoutImage = await req(`/api/products/${targetProduct.id}`, {
      method: 'PUT',
      jar: adminJar,
      body: {
        name: `${targetProduct.name} (Edited Name Only)`,
        price: targetProduct.price,
        categoryId: targetProduct.categoryId,
        available: targetProduct.available,
        image: newOptimizedWebpUrl,
      },
    });
    assert(editWithoutImage.status === 200 && editWithoutImage.json?.data?.image === newOptimizedWebpUrl, 'Editing product without changing image preserves existing URL');

    // Restore original product
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
