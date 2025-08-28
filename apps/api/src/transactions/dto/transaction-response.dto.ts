# Created automatically by Cursor AI (2024-12-19)

import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ required: false })
  merchant_name?: string;

  @ApiProperty()
  account_id: string;

  @ApiProperty({ required: false })
  category_id?: string;

  @ApiProperty()
  is_transfer: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ required: false })
  category_name?: string;

  @ApiProperty({ required: false })
  account_name?: string;
}
