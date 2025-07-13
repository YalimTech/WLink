import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayNotEmpty,
  Matches,
  ValidateIf,
} from 'class-validator';

export class GhlExternalAuthPayloadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  locationId: string[];

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\-]+$/, {
    message: 'instance_id must contain only letters, numbers, or dashes',
  })
  instance_id: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\-]+$/, {
    message: 'api_token_instance must contain only letters, numbers, or dashes',
  })
  api_token_instance: string;
}
