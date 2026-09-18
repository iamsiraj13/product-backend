import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubmitTaskDto } from './dto/tasks.dto';

@ApiTags('Tasks')
@ApiBearerAuth('JWT-auth')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({ summary: 'Generate a new commission task for logged-in user' })
  @Post('generate')
  async generateTask(@CurrentUser('id') userId: string) {
    return this.tasksService.generateTask(userId);
  }

  @ApiOperation({ summary: 'Start a pending task by ID' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/start')
  async startTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
  ) {
    return this.tasksService.startTask(userId, taskId);
  }

  @ApiOperation({ summary: 'Submit rating/review for an in-progress task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/submit')
  async submitTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Body() dto: SubmitTaskDto,
  ) {
    return this.tasksService.submitTask(userId, taskId, dto);
  }

  @ApiOperation({ summary: 'Get all tasks for the logged-in user' })
  @Get()
  async getUserTasks(@CurrentUser('id') userId: string) {
    return this.tasksService.getUserTasks(userId);
  }
}
