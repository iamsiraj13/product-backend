import { IsNotEmpty, IsInt, Min, Max, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitTaskDto {
  @ApiProperty({ example: 5, description: 'Task rating from 1 to 5', minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: 'Rating must be an integer between 1 and 5' })
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiPropertyOptional({ example: 'Great product, high quality!', description: 'Optional task review comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}
