import { prisma } from "../src/lib/prisma";

async function inspectAndClean() {
  console.log("Inspecting existing devices and registration codes...");
  const devices = await prisma.device.findMany();
  console.log(`Found ${devices.length} devices:`);
  devices.forEach(d => console.log(` - [${d.status}] ${d.name} (${d.publicId}) id=${d.id}`));

  const codes = await prisma.deviceRegistrationCode.findMany();
  console.log(`Found ${codes.length} registration codes.`);

  // Clean up test devices and expired codes
  const deletedCodes = await prisma.deviceRegistrationCode.deleteMany({});
  console.log(`Cleaned ${deletedCodes.count} registration codes.`);

  const deletedDevices = await prisma.device.deleteMany({});
  console.log(`Cleaned ${deletedDevices.count} devices.`);

  console.log("Device database is now fresh and clean for production pairing.");
}

inspectAndClean().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
