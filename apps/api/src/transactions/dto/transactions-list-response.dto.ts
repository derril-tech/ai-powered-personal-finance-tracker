# Created automatically by Cursor AI (2024-12-19)

import { ApiProperty } from '@nestjs/swagger';
import { TransactionResponseDto } from './transaction-response.dto';

export class TransactionsListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  transactions: TransactionResponseDto[];

  @ApiProperty({ description: 'Next cursor for pagination', required: false })
  next_cursor?: string;

  @ApiProperty({ description: 'Previous cursor for pagination', required: false })
  prev_cursor?: string;

  @ApiProperty({ description: 'Total count of transactions matching filters' })
  total_count: number;

  @ApiProperty({ description: 'Whether there are more transactions to fetch' })
  has_more: boolean;
}
