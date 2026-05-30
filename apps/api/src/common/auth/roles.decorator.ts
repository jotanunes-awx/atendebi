import { SetMetadata } from '@nestjs/common';
import { AtendeBIRole } from './app-roles';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AtendeBIRole[]) => SetMetadata(ROLES_KEY, roles);
