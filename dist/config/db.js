"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const client_1 = require("@prisma/client");
// Initialize PrismaClient with error handling
let prisma;
try {
    prisma = new client_1.PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
        errorFormat: 'pretty',
    });
}
catch (error) {
    console.error('Failed to initialize Prisma client:', error);
    process.exit(1);
}
// Function to connect to the database
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma.$connect();
        console.log('Connected to database');
    }
    catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
});
exports.connectDB = connectDB;
exports.default = prisma;
