import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Configuration
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { EntitiesModule } from './modules/entities/entities.module';
import { UsersModule } from './modules/users/users.module';
import { QrCodesModule } from './modules/qr-codes/qr-codes.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { EmailModule } from './modules/email/email.module';

// Common
import { DatabaseModule } from './common/database/database.module';
import { QueueModule } from './common/queue/queue.module';
import { SecurityModule } from './common/security/security.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.mongodbUri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ([{
        ttl: configService.get<number>('rateLimit.default.ttl') || 60000,
        limit: configService.get<number>('rateLimit.default.limit') || 100,
      }]),
      inject: [ConfigService],
    }),

    // Queue management
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),

    // Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Common modules
    DatabaseModule,
    QueueModule,
    SecurityModule,
    HealthModule,

    // Feature modules
    AuthModule,
    EntitiesModule,
    UsersModule,
    QrCodesModule,
    OnboardingModule,
    EmailModule,
  ],
})
export class AppModule {}
