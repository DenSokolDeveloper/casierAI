import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { DefaultValuePipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.shopId);
  }

  @Get('sales-by-day')
  salesByDay(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getSalesByDay(days, user.shopId);
  }

  @Get('top-products')
  topProducts(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getTopProducts(days, limit, user.shopId);
  }

  @Get('low-stock')
  lowStock(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getLowStock(user.shopId);
  }
}
