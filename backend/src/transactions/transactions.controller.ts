import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.create(dto, user.userId, user.shopId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.findAll(user.shopId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.findOne(id, user.shopId);
  }
}
