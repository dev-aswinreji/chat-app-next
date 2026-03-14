import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MarkReadDto {
  @ApiProperty()
  @IsString()
  withUserId: string;
}

export class LastSeenResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  withUserId: string;

  @ApiProperty({ required: false })
  lastReadAt?: string | null;
}

export class UnreadCountDto {
  @ApiProperty()
  fromUserId: string;

  @ApiProperty()
  unreadCount: number;
}
