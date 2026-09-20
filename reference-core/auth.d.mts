export function validatePassword(password: string): void;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, stored: string): Promise<boolean>;
export function newSessionToken(): string;
export function hashSessionToken(token: string): string;
export function generateLocalPasscode(): string;
