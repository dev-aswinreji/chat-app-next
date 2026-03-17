"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const express_api_reference_1 = require("@scalar/express-api-reference");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, cookie_parser_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true }));
    const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((v) => v.trim())
        : null;
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (!allowedOrigins || allowedOrigins.includes('*')) {
                return callback(null, true);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'), false);
        },
        credentials: true,
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Chat API')
        .setDescription('Auth + chat API')
        .setVersion('1.0')
        .addBearerAuth()
        .addCookieAuth('refresh_token')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    app.use('/docs', (0, express_api_reference_1.apiReference)({
        content: document,
        theme: 'purple',
    }));
    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`API running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map