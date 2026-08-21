import { Controller, Get, Query, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/tenant.decorator";

interface JwtUser { sub: string; tenantId: string; role: string }

@ApiTags("search")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("customers")
  searchCustomers(
    @CurrentUser() user: JwtUser,
    @Query("query") query: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20"
  ) {
    return this.searchService.searchCustomers(user.tenantId, {
      query: query ?? "",
      page: parseInt(page, 10),
      pageSize: Math.min(parseInt(pageSize, 10), 100),
    });
  }

  @Get("products")
  searchProducts(
    @CurrentUser() user: JwtUser,
    @Query("query") query: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20"
  ) {
    return this.searchService.searchProducts(user.tenantId, {
      query: query ?? "",
      page: parseInt(page, 10),
      pageSize: Math.min(parseInt(pageSize, 10), 100),
    });
  }

  @Get("countries")
  getCountries(@CurrentUser() user: JwtUser, @Query("q") q?: string) {
    return this.searchService.getCountries(user.tenantId, q ?? "");
  }

  @Get("customers/:id/addresses")
  getAddresses(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.searchService.getCustomerAddresses(user.tenantId, id);
  }

  @Get("products/:id/stock")
  getStock(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Query("warehouseId") warehouseId?: string
  ) {
    return this.searchService.getProductStock(user.tenantId, id, warehouseId);
  }

  @Get("products/:id/price")
  getPrice(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Query("customerId") customerId?: string,
    @Query("quantity") quantity?: string
  ) {
    return this.searchService.getProductPrice(
      user.tenantId,
      id,
      customerId,
      quantity ? parseInt(quantity, 10) : 1
    );
  }
}
