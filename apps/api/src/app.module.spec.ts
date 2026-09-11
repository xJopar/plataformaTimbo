import { AppModule } from './app.module';
import { MetaCompanyModule } from './modules/meta-company/meta-company.module';

describe('AppModule', () => {
  it('carga Meta Company mediante Service Layer', () => {
    expect(AppModule.register().imports).toContain(MetaCompanyModule);
  });
});
