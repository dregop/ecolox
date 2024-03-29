


import { BannerComponent } from './customComponents/banner/banner.component';
import { MenuComponent } from './customComponents/menu/menu.component';
import { AuthService } from './services/auth.service';
import { AuthInterceptor } from './auth.interceptor';
import { LegalMentionsComponent } from './pages/legal-mentions/legal-mentions.component';
import { ToggleButtonComponent } from './customComponents/toggle-button/toggle-button.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { OverlayMessageComponent } from './customComponents/overlay-message/overlay-message.component';
import { HouseComponent } from './pages/house/house.component';
import { RankComponent } from './pages/rank/rank.component';
import { ShoppingComponent } from './pages/shopping/shopping.component';
import { LoaderComponent } from './customComponents/loader/loader.component';
import { InternetComponent } from './pages/internet/internet.component';
import { LineChartComponent } from './pages/internet/line-chart/line-chart.component';
import { LineChartShoppingComponent } from './pages/shopping/line-chart-shopping/line-chart-shopping.component';
import { BarChartComponent } from './pages/internet/bar-chart/bar-chart.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AppComponent } from './app.component';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { GlobalComponent } from './pages/global/global.component';
import { TravelComponent } from './pages/travel/travel.component';
import { LineChartTravelComponent } from './pages/travel/line-chart-travel/line-chart-travel.component';


@NgModule({
  declarations: [
    AppComponent,
    BannerComponent,
    MenuComponent,
    LegalMentionsComponent,
    ToggleButtonComponent,
    ResetPasswordComponent,
    LineChartComponent,
    LineChartShoppingComponent,
    LineChartTravelComponent,
    OverlayMessageComponent,
    InternetComponent,
    HouseComponent,
    RankComponent,
    BarChartComponent,
    ShoppingComponent,
    LoaderComponent,
    TravelComponent,
    GlobalComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule
  ],
  providers: [
    AuthService,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}