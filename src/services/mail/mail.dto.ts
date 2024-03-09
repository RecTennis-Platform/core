import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendMailTemplateDto {
  @IsArray()
  @IsEmail({}, { each: true })
  toAddresses: string[];

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  ccAddresses: string[];

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  bccAddresses: string[];

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsString()
  templateData: string;
}
