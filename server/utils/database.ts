import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '~/prisma/generated/client';

const prismaClientSingleton = () => {
    // extract host, port, user, password from DATABASE_URL
    const url = process.env.DATABASE_URL;
    const host = url?.split('@')[1]?.split(':')[0];
    const port = url?.split('@')[1]?.split(':')[1]?.split('/')[0];
    const user = url?.split('//')[1]?.split(':')[0];
    const database = url?.split('/')[3];
    const password = url?.split('//')[1]?.split(':')[1]?.split('@')[0];

    const adapter = new PrismaMariaDb({
        host,
        user,
        password,
        port: Number(port),
        database,
        connectionLimit: 100
    });
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Sponsor database functions
export async function getAllSponsors (): Promise<Sponsor[]> {
    const sponsors = await prisma.sponsor.findMany({
        orderBy: { createdAt: 'desc' }
    });
    return sponsors.map(sponsor => ({
        ...sponsor,
        hideAfter: sponsor.hideAfter ? sponsor.hideAfter.toISOString() : null,
        createdAt: sponsor.createdAt.toISOString(),
        updatedAt: sponsor.updatedAt.toISOString()
    }));
}

export async function getActiveSponsors (): Promise<Sponsor[]> {
    const sponsors = await prisma.sponsor.findMany({
        where: {
            OR: [
                { hideAfter: null },
                { hideAfter: { gt: new Date() } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });
    return sponsors.map(sponsor => ({
        ...sponsor,
        hideAfter: sponsor.hideAfter ? sponsor.hideAfter.toISOString() : null,
        createdAt: sponsor.createdAt.toISOString(),
        updatedAt: sponsor.updatedAt.toISOString()
    }));
}

export async function getSponsorById (id: string): Promise<Sponsor | null> {
    const sponsor = await prisma.sponsor.findUnique({
        where: { id }
    });
    if (!sponsor) {
        return null;
    }
    return {
        ...sponsor,
        hideAfter: sponsor.hideAfter ? sponsor.hideAfter.toISOString() : null,
        createdAt: sponsor.createdAt.toISOString(),
        updatedAt: sponsor.updatedAt.toISOString()
    };
}

export async function createSponsor (sponsorData: Omit<Sponsor, 'createdAt' | 'updatedAt'>): Promise<Sponsor> {
    const sponsor = await prisma.sponsor.create({
        data: {
            id: sponsorData.id,
            name: sponsorData.name,
            image: sponsorData.image,
            url: sponsorData.url,
            class: sponsorData.class,
            hideAfter: sponsorData.hideAfter ? new Date(sponsorData.hideAfter) : null
        }
    });
    return {
        ...sponsor,
        hideAfter: sponsor.hideAfter ? sponsor.hideAfter.toISOString() : null,
        createdAt: sponsor.createdAt.toISOString(),
        updatedAt: sponsor.updatedAt.toISOString()
    };
}

export async function updateSponsor (id: string, updates: Partial<Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Sponsor | null> {
    const existing = await prisma.sponsor.findUnique({ where: { id } });
    if (!existing) {
        return null;
    }

    const sponsor = await prisma.sponsor.update({
        where: { id },
        data: {
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.image !== undefined && { image: updates.image }),
            ...(updates.url !== undefined && { url: updates.url }),
            ...(updates.class !== undefined && { class: updates.class }),
            ...(updates.hideAfter !== undefined && {
                hideAfter: updates.hideAfter ? new Date(updates.hideAfter) : null
            })
        }
    });

    return {
        ...sponsor,
        hideAfter: sponsor.hideAfter ? sponsor.hideAfter.toISOString() : null,
        createdAt: sponsor.createdAt.toISOString(),
        updatedAt: sponsor.updatedAt.toISOString()
    };
}

export async function deleteSponsor (id: string): Promise<boolean> {
    try {
        await prisma.sponsor.delete({ where: { id } });
        return true;
    } catch {
        return false;
    }
}

// Session database functions
export async function getSession (token: string): Promise<{ username: string; expiresAt: number } | null> {
    const session = await prisma.session.findUnique({
        where: { token }
    });
    if (!session) {
        return null;
    }
    return {
        username: session.username,
        expiresAt: Number(session.expiresAt)
    };
}

export async function createSession (token: string, username: string, expiresAt: number): Promise<void> {
    await prisma.session.create({
        data: {
            token,
            username,
            expiresAt
        }
    });
}

export async function deleteSession (token: string): Promise<void> {
    await prisma.session.delete({ where: { token } }).catch(() => {});
}

export async function cleanExpiredSessions (): Promise<void> {
    await prisma.session.deleteMany({
        where: {
            expiresAt: { lt: BigInt(Date.now()) }
        }
    });
}

// Helper function to validate admin session
export async function validateAdminSession (event: any): Promise<{ username: string; expiresAt: number }> {
    const sessionToken = getCookie(event, 'session');

    if (!sessionToken) {
        throw createError({
            statusCode: 401,
            statusMessage: 'unauthorized'
        });
    }

    const session = await getSession(sessionToken);

    if (!session || session.expiresAt < Date.now()) {
        if (session) {
            await deleteSession(sessionToken);
        }
        deleteCookie(event, 'session');
        throw createError({
            statusCode: 401,
            statusMessage: 'unauthorized'
        });
    }

    return session;
}

// User database functions
export async function getAllUsers (): Promise<User[]> {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    });
    return users.map(user => ({
        ...user,
        password: undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    })) as User[];
}

export async function getUserById (id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
        where: { id }
    });
    if (!user) {
        return null;
    }
    return {
        ...user,
        password: undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    } as User;
}

export async function getUserByUsername (username: string): Promise<(User & { password: string }) | null> {
    return await prisma.user.findUnique({
        where: { username }
    });
}

export async function createUser (userData: { username: string; password: string; email?: string; role?: string }): Promise<User> {
    const user = await prisma.user.create({
        data: {
            username: userData.username,
            password: userData.password,
            email: userData.email || null,
            role: userData.role || 'user'
        }
    });
    return {
        ...user,
        password: undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    } as User;
}

export async function updateUser (id: string, updates: { username?: string; password?: string; email?: string | null; role?: string; active?: boolean }): Promise<User | null> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
        return null;
    }

    const user = await prisma.user.update({
        where: { id },
        data: {
            ...(updates.username !== undefined && { username: updates.username }),
            ...(updates.password !== undefined && { password: updates.password }),
            ...(updates.email !== undefined && { email: updates.email }),
            ...(updates.role !== undefined && { role: updates.role }),
            ...(updates.active !== undefined && { active: updates.active })
        }
    });

    return {
        ...user,
        password: undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    } as User;
}

export async function deleteUser (id: string): Promise<boolean> {
    try {
        await prisma.user.delete({ where: { id } });
        return true;
    } catch {
        return false;
    }
}
