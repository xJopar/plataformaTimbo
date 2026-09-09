import { AppModule } from './app.module';
import { MetaCompanyModule } from './modules/meta-company/meta-company.module';

describe('AppModule', () => {
  it('no carga Meta Company cuando está deshabilitada', () => {
    expect(AppModule.register(false).imports).not.toContain(MetaCompanyModule);
  });

  it('carga Meta Company cuando está habilitada', () => {
    expect(AppModule.register(true).imports).toContain(MetaCompanyModule);
  });
});
