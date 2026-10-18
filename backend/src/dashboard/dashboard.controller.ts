import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { DefaultValuePipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboardService.getSummary();
  }

  @Get('sales-by-day')
  salesByDay(@Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number) {
    return this.dashboardService.getSalesByDay(days);
  }

  @Get('top-products')
  topProducts(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getTopProducts(days, limit);
  }

  @Get('low-stock')
  lowStock() {
    return this.dashboardService.getLowStock();
  }
}
