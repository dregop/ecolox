import { Component, OnInit } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundGeolocationService } from 'src/app/services/background-geolocation.service';
import { TravelService } from './services/travel.service';
import {
  BackgroundGeolocationPlugin,
  ConfigureOptions,
  Location,
} from "cordova-background-geolocation-plugin";
import { API_URL } from 'src/environments/env.dev';
import { PluginListenerHandle } from '@capacitor/core';
import { Motion } from '@capacitor/motion';

// access to its functions
declare const BackgroundGeolocation: BackgroundGeolocationPlugin;

export  class Travel {
  name?: string;
  date!: any;
  speed!: number;
  co2!: number;
}

@Component({
  selector: 'app-travel',
  templateUrl: './travel.component.html',
  styleUrls: ['./travel.component.scss']
})
export class TravelComponent implements OnInit {
  private geoloc: any;
  private accelHandler!: PluginListenerHandle;
  private options = {
    enableHighAccuracy: true,
    timeout: 5000,
  };

  private config!: ConfigureOptions;
  public travelTimeSerie: Travel[] = [];
  
  constructor(private geolocationService: BackgroundGeolocationService, private travelService: TravelService) {}
  
  ngOnInit(): void {
    this.updateData();
  }

  updateData() {
    console.log('#update Data');
    this.geolocationService.getData().subscribe({
      next: (val) => {
        if (val && val.data) {
        this.travelTimeSerie = JSON.parse(val.data);
        this.travelTimeSerie = this.travelService.formatDate(this.travelTimeSerie);
        console.log('# Database data');
        console.log(this.travelTimeSerie);
        }
      },
      error: (error) => {
        console.log(error);
      }
    });
  }

  // call this function to track!
  async init() {
    this.config = {
      // shared config
      debug: true,
      interval: 10000, // 10sec
      fastestInterval: 60000, // 1min Fastest rate in milliseconds at which your app can handle location updates.
      activitiesInterval: 1000, /* Rate in milliseconds at which activity recognition occurs.
      * Larger values will result in fewer activity detections while improving battery life. */
      stationaryRadius: 100,
      desiredAccuracy: BackgroundGeolocation.LOW_ACCURACY,
      locationProvider: BackgroundGeolocation.RAW_PROVIDER,
      distanceFilter: 50, // When stopped, the minimum distance the device must move beyond the stationary location for aggressive background-tracking to engage.
    
      // android specific config
      startForeground: true,
      notificationsEnabled: true,
      notificationTitle: "Tracking",
      notificationText: "Your location is being tracked!",
      notificationIconColor: "#424242",
      notificationIconSmall: "ic_location",
    
      // ios specific config
      saveBatteryOnBackground: true,
      pauseLocationUpdates: false,
    };
    // insert config
    await BackgroundGeolocation.configure(this.config);

    // this will trigger the permission request if not yet granted
    await BackgroundGeolocation.start();

    BackgroundGeolocation.on('start', function() {
      console.log('[INFO] BackgroundGeolocation service has been started');
    });  

    BackgroundGeolocation.on('error', function(error) {
      console.log('[ERROR] BackgroundGeolocation error:', error.code, error.message);
    });

    BackgroundGeolocation.on('authorization', function(status) {
      console.log('[INFO] BackgroundGeolocation authorization status: ' + status);
      if (status !== BackgroundGeolocation.AUTHORIZED) {
        // we need to set delay or otherwise alert may not be shown
        setTimeout(() => {
          var showSettings = confirm('App requires location tracking permission. Would you like to open app settings?');
          if (showSettings) {
            return BackgroundGeolocation.showAppSettings();
          } else return;
        }, 1000);
      }
    });

    // create a listener for location updates
    BackgroundGeolocation.on("location")
      .subscribe((location) => this.updateLocation(location));
  
    BackgroundGeolocation.on('background', function() {
      console.log('[INFO] App is in background');
      // you can also reconfigure service (changes will be applied immediately)
      BackgroundGeolocation.configure({ debug: true });
    });
  
    BackgroundGeolocation.on('foreground', function() {
      console.log('[INFO] App is in foreground');
      BackgroundGeolocation.configure({ debug: false });
    });

    BackgroundGeolocation.checkStatus(function(status) {
      console.log('[INFO] BackgroundGeolocation service is running', status.isRunning);
      console.log('[INFO] BackgroundGeolocation services enabled', status.locationServicesEnabled);
      console.log('[INFO] BackgroundGeolocation auth status: ' + status.authorization);
  
      // you don't need to check status before start (this is just the example)
      if (!status.isRunning) {
        BackgroundGeolocation.start(); //triggers start on start event
      }
    });
  }

  private updateLocation(location: Location) {
    this.updateData();

    if (location == undefined) return;
    console.log("Speed:", location.speed);
    const speedSpan = document.getElementById('speed_background');
    if (location.speed && speedSpan) {
      speedSpan.innerHTML = Math.trunc(location.speed as number * 3.6)  + ' km/h'; // m/s in km/h
          this.travelTimeSerie.push({speed: location.speed, date: new Date(), co2: 0});
          this.geolocationService.saveLocation({
            'category': 'travel',
            'data': JSON.stringify(this.travelTimeSerie)
          }).subscribe({
            next: () => {
              console.log('data saved');
            },
            error: (error) => {
              console.log(error);
            }
          });
    }
  }

  public async start() {
    // this.init();

    try {
       (DeviceMotionEvent as any).requestPermission();
    } catch (e) {
      // Handle error
      return;
    }

    // Once the user approves, can start listening:
    this.accelHandler = await Motion.addListener('accel', (event: any) => {
      console.log('Device motion event:', event);
    });
    // const _this = this;
    // setInterval(async () => {
    //   this.geoloc = await Geolocation.watchPosition(this.options, (pos: any) => {
    //     const speedSpan = document.getElementById('speed');
    //     if (pos && pos.coords && speedSpan) {
    //       const speed = Math.trunc(pos.coords.speed as number * 3.6);
    //       speedSpan.innerHTML = speed  + ' km/h';
    //       this.travelTimeSerie.push({speed: speed, date: new Date(), co2: 0});
    //       this.geolocationService.saveLocation({
    //         'category': 'travel',
    //         'data': JSON.stringify(this.travelTimeSerie)
    //       }).subscribe({
    //         next: () => {
    //           console.log('data saved');
    //         },
    //         error: (error) => {
    //           console.log(error);
    //         }
    //       });
    //     }
    //   });
    // }, 2000);
  }

  public stop() {
    Geolocation.clearWatch(this.geoloc);
    if (this.accelHandler) {
      this.accelHandler.remove();
    }
  }

  // public start() {
  //   BackgroundGeolocation.addWatcher(
  //     {
  //         // If the "backgroundMessage" option is defined, the watcher will
  //         // provide location updates whether the app is in the background or the
  //         // foreground. If it is not defined, location updates are only
  //         // guaranteed in the foreground. This is true on both platforms.
  
  //         // On Android, a notification must be shown to continue receiving
  //         // location updates in the background. This option specifies the text of
  //         // that notification.
  //         backgroundMessage: "Cancel to prevent battery drain.",
  
  //         // The title of the notification mentioned above. Defaults to "Using
  //         // your location".
  //         backgroundTitle: "Tracking You.",
  
  //         // Whether permissions should be requested from the user automatically,
  //         // if they are not already granted. Defaults to "true".
  //         requestPermissions: true,
  
  //         // If "true", stale locations may be delivered while the device
  //         // obtains a GPS fix. You are responsible for checking the "time"
  //         // property. If "false", locations are guaranteed to be up to date.
  //         // Defaults to "false".
  //         stale: false,
  
  //         // The minimum number of metres between subsequent locations. Defaults
  //         // to 0.
  //         distanceFilter: 50
  //     },
  //     function callback(location, error) {
  //         if (error) {
  //             if (error.code === "NOT_AUTHORIZED") {
  //                 if (window.confirm(
  //                     "This app needs your location, " +
  //                     "but does not have permission.\n\n" +
  //                     "Open settings now?"
  //                 )) {
  //                     // It can be useful to direct the user to their device's
  //                     // settings when location permissions have been denied. The
  //                     // plugin provides the 'openSettings' method to do exactly
  //                     // this.
  //                     BackgroundGeolocation.openSettings();
  //                 }
  //             }
  //             return console.error(error);
  //         }
  
  //         return console.log(location);
  //     }
  // ).then(function after_the_watcher_has_been_added(watcher_id) {
  //     // When a watcher is no longer needed, it should be removed by calling
  //     // 'removeWatcher' with an object containing its ID.
  //     BackgroundGeolocation.removeWatcher({
  //         id: watcher_id
  //     });
  // });
  
  // // // The location object.
  // // {
  // //     // Longitude in degrees.
  // //     longitude: 131.723423719132,
  // //     // Latitude in degrees.
  // //     latitude: -22.40106297456,
  // //     // Radius of horizontal uncertainty in metres, with 68% confidence.
  // //     accuracy: 11,
  // //     // Metres above sea level (or null).
  // //     altitude: 65,
  // //     // Vertical uncertainty in metres, with 68% confidence (or null).
  // //     altitudeAccuracy: 4,
  // //     // Deviation from true north in degrees (or null).
  // //     bearing: 159.60000610351562,
  // //     // True if the location was simulated by software, rather than GPS.
  // //     simulated: false,
  // //     // Speed in metres per second (or null).
  // //     speed: 23.51068878173828,
  // //     // Time the location was produced, in milliseconds since the unix epoch.
  // //     time: 1562731602000
  // // }
  
  // // If you just want the current location, try something like this. The longer
  // // the timeout, the more accurate the guess will be. I wouldn't go below about
  // // 100ms.

  //   this.guess_location;
  // }

  // private guess_location(callback: any, timeout: number) {
  //   let last_location: any;
  //   BackgroundGeolocation.addWatcher(
  //       {
  //           requestPermissions: false,
  //           stale: true
  //       },
  //       function (location) {
  //           last_location = location || undefined;
  //           const speedSpan = document.getElementById('speed');
  //           if (speedSpan) {
  //             speedSpan.innerHTML = 'lol';
  //             if (last_location.coords.speed) {
  //               speedSpan.innerHTML = last_location.coords.speed;
  //             }
  //           }
  //       }
  //   ).then(function (id) {
  //       setTimeout(function () {
  //           callback(last_location);
  //           BackgroundGeolocation.removeWatcher({id});
  //       }, timeout);
  //   });
  // }
}
