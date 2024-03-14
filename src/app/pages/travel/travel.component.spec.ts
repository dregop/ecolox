import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TravelComponent } from './TravelComponent';

describe('TravelComponent', () => {
  let component: TravelComponent;
  let fixture: ComponentFixture<TravelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TravelComponent]
    });
    fixture = TestBed.createComponent(TravelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
