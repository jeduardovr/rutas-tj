import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminProposalsComponent } from './admin-proposals.component';

describe('AdminProposalsComponent', () => {
  let component: AdminProposalsComponent;
  let fixture: ComponentFixture<AdminProposalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProposalsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProposalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
