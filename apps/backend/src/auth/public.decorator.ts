import { SetMetadata } from '@nestjs/common';

export const publicRouteMetadata = 'solis.public-route';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(publicRouteMetadata, true);
