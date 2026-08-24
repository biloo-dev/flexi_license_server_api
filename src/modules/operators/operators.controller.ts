import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OperatorsService } from './operators.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Operators')
@Controller('operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all active cellular operators (Djezzy, Mobilis, Ooredoo)' })
  async findAll() {
    return this.operatorsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get operator by ID (e.g. djezzy, mobilis, ooredoo)' })
  async findById(@Param('id') id: string) {
    return this.operatorsService.findById(id);
  }
}
