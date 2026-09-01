import { hash } from 'bcrypt';
import { config } from 'dotenv';
import { prisma } from '../server/utils/database';

async function main () {
    const { parsed } = config({
        path: ['stack.env', '.env']
    });

    if (!parsed) {
        throw new Error('No .env file found');
    }
    const adminUsername = parsed.ADMIN_USERNAME;
    const adminPassword = parsed.ADMIN_PASSWORD;
    if (!adminUsername || !adminPassword) {
        throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env file');
    }

    console.log('Seeding database...');
    await prisma.user.upsert({
        where: { username: adminUsername },
        update: {},
        create: {
            username: adminUsername,
            password: await hash(adminPassword, 10),
            role: 'admin',
            active: true
        }
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
