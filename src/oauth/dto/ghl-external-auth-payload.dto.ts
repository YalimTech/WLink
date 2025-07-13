import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
} from 'class-validator';

export class GhlExternalAuthPayloadDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\-]+$/, {
    message: 'instance_id must contain only letters, numbers, or dashes',
  })
  instance_id?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\-]+$/, {
    message: 'api_token_instance must contain only letters, numbers, or dashes',
  })
  api_token_instance?: string;
}

