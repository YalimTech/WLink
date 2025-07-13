import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty } from 'class-validator';

export class GhlExternalAuthPayloadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  locationId: string[];

  @IsString()
  @IsNotEmpty()
  instance_id: string;

  @IsString()
  @IsNotEmpty()
  api_token_instance: string;
}
