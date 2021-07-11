import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule' 

import { AuthModule } from './auth/auth.module'
import { UserModule } from './user/user.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { User } from './user/entities/user.entity'
import { Project } from './project/entity/project.entity'
import { Analytics } from './analytics/entities/analytics.entity'
import { ProjectModule } from './project/project.module'
import { MailerModule } from './mailer/mailer.module'
import { ActionTokensModule } from './action-tokens/action-tokens.module'
import { ActionToken } from './action-tokens/action-token.entity'
import { TaskManagerModule } from './task-manager/task-manager.module'

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env' }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: 3306,
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_ROOT_PASSWORD || '123123123',
      database: process.env.MYSQL_DATABASE || 'analytics',
      synchronize: true,
      entities: [User, ActionToken, Project, Analytics],
    }),
    ScheduleModule.forRoot(),
    TaskManagerModule,
    AuthModule,
    UserModule,
    MailerModule,
    ActionTokensModule,
    ProjectModule,
    AnalyticsModule,
  ],
})

export class AppModule {}

