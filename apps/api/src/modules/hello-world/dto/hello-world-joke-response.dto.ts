import { ApiProperty } from '@nestjs/swagger';
import type { HelloWorldJoke } from '../hello-world.service';

export class HelloWorldJokeResponseDto {
  @ApiProperty({ example: 'R7UfaahVfFd' })
  id!: string;

  @ApiProperty({ example: 'Why did the scarecrow win an award? He was outstanding in his field.' })
  originalText!: string;
}

export function toHelloWorldJokeResponse(joke: HelloWorldJoke): HelloWorldJokeResponseDto {
  return joke;
}
