import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import { Co2ByOriginByTime } from '../internet.component';
import { GraphService } from '../services/graph.service';
import { ToastService, toastType } from 'src/app/services/toast.service';
import { UserFeatures } from 'src/app/models/userFeatures';
import { UserService } from 'src/app/services/user.service';
import { Line } from 'src/app/models/line';

@Component({
  selector: 'line-chart',
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnInit {

  @ViewChild('chart') chartElement!: ElementRef;

  parseDate = d3.timeParse('%d-%m-%Y');

  public dataSumDbExtCo2TimeSerieFiltered: Co2ByOriginByTime[] = [];
  public dataDrawnCo2TimeSerie: Co2ByOriginByTime[] = [];
  public dataThreshold: Co2ByOriginByTime[] = [];
  public linesDaysOfWeek: Line[] = [];
  public chartProps!: any;
  private glines: any;
  private valueslines: Line[] = [];
  private zoom!: any;
  private onZoom = false;
  public isExtensionMessageDisplayed = false;
  public browserName: string = "Chrome";
  private thresholdCo2 = 2000; // 100 kg de Co2eq
  public userFeatures!: UserFeatures;
  public tonnes!: number;
  public degres!: number;
  public daysOfWeek!: HTMLCollection;
  public dayOfWeekNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  public mainLine!: Line;
  public globalLine!: Line;
  public currentSelectedDayOfWeek = new Date().getDay();
  public currentSelectedDayOfMonth = new Date().getDate();
  public currentSelectedMonth = new Date().getMonth();
  public currentSelectedYear = new Date().getFullYear();

  
  @Input() public dataDb: Co2ByOriginByTime[] = [];
  @Input() public dataExt: Co2ByOriginByTime[] = [];
  @Input() public dataGlobal: Co2ByOriginByTime[] = [];
  @Input() public firstDataExt: Co2ByOriginByTime[] = [];
  @Input() public dataSumDbExt: Co2ByOriginByTime[] = [];
  constructor(private graphService: GraphService, public toastService: ToastService, private userService: UserService) {
    this.userService.$userFeatures.subscribe({
      next: (features) => {
        console.log(features);
        if (features && features.level) {
          this.userFeatures = features;
        } else {
          // const overlay_message = document.getElementById('overlay_message');
          // if (overlay_message) {
          //   overlay_message.style.display = 'block';
          // }
        }
      },
      error: (err) => console.log(err.message)
    });
  }
  
  ngOnInit(): void {

    this.graphService.$browserName.subscribe((browser) => {
      this.browserName = browser;
    });

    this.graphService.setD3Locale(); // initiate date for x graph 

    let loop = 0;
    const draw = setInterval(() => {
      if (this.chartProps && this.dataSumDbExt.length > 0) {
        // this.updateChart();
      } else if (this.dataSumDbExt.length > 0 && this.dataGlobal.length > 0) {
        this.buildChart();
      }
      loop++;
      if (loop > 1000) { // ~15 min we stop updating chart
        clearInterval(draw);
      }

    }, 1000);

    // Add an event listener that run the function when dimension change
    window.addEventListener('resize', updateOnResize);
    const _this = this;
    function updateOnResize() {
      // get the current width of the div where the chart appear, and attribute it to Svg
      if (_this.chartProps) {
        // const newWidth = document.body.clientWidth - 200;
        const newWidth = document.getElementById('chart')?.clientWidth;
        const newHeight = document.getElementById('chart')?.clientHeight;
        if (newWidth && newHeight) {
          console.log('# on resize');

          _this.chartProps.svg
          .attr("viewBox", '0 0 ' +  newWidth + ' ' +newHeight );

          _this.chartProps.x.range([ 0, newWidth - _this.chartProps.margin.left - _this.chartProps.margin.right ]);
          _this.chartProps.y.range([ newHeight - _this.chartProps.margin.top - _this.chartProps.margin.bottom, 0]);

          _this.chartProps.svgBox.select('.x.axis') // update x axis
          .attr('transform', `translate(0,${newHeight  - _this.chartProps.margin.top - _this.chartProps.margin.bottom})`)
          .call(_this.chartProps.xAxis, _this.chartProps.x);
          _this.chartProps.svgBox.select('.y.axis') // update y axis
          .call(_this.chartProps.yAxis, _this.chartProps.y);


          _this.chartProps.svgBox.select('.arrow')
          .attr("x", newWidth - 50 - _this.chartProps.margin.top )
          .attr("y", newHeight -37 - _this.chartProps.margin.bottom);

          // update mouseemove 
          _this.chartProps.listeningRect
          .attr('width', newWidth)
          .attr('height', newHeight);

          _this.chartProps.width = newWidth - _this.chartProps.margin.left - _this.chartProps.margin.right;
          _this.chartProps.height = newHeight - _this.chartProps.margin.top - _this.chartProps.margin.bottom;

          _this.updateChart();
        }
      }
    }

    const zoomButton = document.getElementById('zoomButton');
    zoomButton?.addEventListener('click', () => {
      if (this.zoom !== null) {
        if (zoomButton.className.includes('activated')) {
          document.body.style.cursor =  "auto";
          zoomButton.className = 'btn-graph';
          zoomButton.title = 'Zoomer';
          this.chartProps.svgBox.transition()
          .duration(750)
          .call(this.zoom.transform, d3.zoomIdentity);
          this.chartProps.svgBox.on('.zoom', null);
        } else {
          document.body.style.cursor =  "all-scroll";
          zoomButton.title = 'Désactiver le zoom';
          zoomButton.className = 'btn-graph activated';
          this.chartProps.svgBox.call(this.zoom as any, d3.zoomIdentity);
        }
        this.onZoom = !this.onZoom; // to disable update when we want to zoom/pan
        this.graphService.$onZoom.next(this.onZoom); // propage to graphService
      }
    });

    const globalDataButton = document.getElementById('global_data');
    globalDataButton?.addEventListener('click', () => {
      if (globalDataButton.className.includes('activated')) {
        globalDataButton.className = 'btn-graph';
        this.globalLine.hide();
      } else {
        globalDataButton.className = 'btn-graph activated';
        this.globalLine.show();
      }
      this.updateChart();
    });

    const treasholdButton = document.getElementById('treashold');
    treasholdButton?.addEventListener('click', () => {
      if (treasholdButton.className.includes('activated')) {
        this.graphService.scaleXYDomain(this.dataDrawnCo2TimeSerie, this.chartProps.x, this.chartProps.y);
        this.zoomTransform();
        this.chartProps.svgBox.on('.zoom', null);
        treasholdButton.className = 'btn-graph';
        this.valueslines[2].hide();
      } else {
        const sumAllData = [...this.dataThreshold];
        this.dataDrawnCo2TimeSerie.forEach((data) => {
          sumAllData.push(data);
        });
        if (!dayButton?.className.includes('activated')) {
          this.graphService.scaleXYDomain(sumAllData, this.chartProps.x, this.chartProps.y);
          this.zoomTransform();
          this.chartProps.svgBox.on('.zoom', null);
        }
        treasholdButton.className = 'btn-graph activated';
        this.valueslines[2].show();
      }
      this.updateChart();
    });

    const dayButton = document.getElementById('day');
    const weekButton = document.getElementById('week');
    const monthButton = document.getElementById('month');
    const allButton = document.getElementById('all');

    dayButton?.addEventListener('click', () => {
      console.log('Range : day of month nbr ' + this.currentSelectedDayOfMonth);
      let zoomActif = false;
      if (this.onZoom) {
        zoomActif = true;
        this.onZoom = false; // so we can update
      }
      this.dataSumDbExtCo2TimeSerieFiltered = this.dataSumDbExt.filter(d => new Date(d.date).getDate() === this.currentSelectedDayOfMonth && new Date(d.date).getMonth() === this.currentSelectedMonth && new Date(d.date).getFullYear() === this.currentSelectedYear);

      // let day = 1;
      // while (this.dataDbCo2TimeSerieFiltered.length === 0) {
      //   this.dataDbCo2TimeSerieFiltered = this.dataDb.filter(d => new Date(d.date).getDate() === new Date().getDate() - day && new Date(d.date).getMonth() === new Date().getMonth() && new Date(d.date).getFullYear() === new Date().getFullYear());
      //   this.toastService.handleToast(toastType.Info, 'Pas de donnée enregistrée disponible pour le ' + (new Date().getDate() - day + 1));
      //   day++;
      // }
      dayButton.className = 'btn-graph activated';

      const rightButtonDay = document.getElementById('right-button-day');
      const leftButtonDay = document.getElementById('left-button-day');

      if (rightButtonDay && leftButtonDay) {
        (rightButtonDay as HTMLInputElement).disabled = false;
        rightButtonDay.style.opacity = '1';    
        (leftButtonDay as HTMLInputElement).disabled = false;
        leftButtonDay.style.opacity = '1';    
      }
  
      if (this.currentSelectedDayOfMonth === new Date().getDate() && this.currentSelectedMonth === new Date().getMonth() && this.currentSelectedYear === new Date().getFullYear() && rightButtonDay) {
        (rightButtonDay as HTMLInputElement).disabled = true;
        rightButtonDay.style.opacity = '0.3';
      }
  
      if (this.dataSumDbExt.length > 0 && this.currentSelectedDayOfMonth === new Date(this.dataSumDbExt[0].date).getDate() && this.currentSelectedMonth === new Date(this.dataSumDbExt[0].date).getMonth() && this.currentSelectedYear === new Date(this.dataSumDbExt[0].date).getFullYear() && leftButtonDay) {
        (leftButtonDay as HTMLInputElement).disabled = true;
        leftButtonDay.style.opacity = '0.3';
      }
    
      if (allButton) {
        allButton.className = 'btn-graph';
      }
      if (weekButton) {
        weekButton.className = 'btn-graph';
      }
      if (monthButton) {
        monthButton.className = 'btn-graph';
      }

      //  Add lines if on click on checkboxes (wait a bit so the inputs are added to the DOM)
      setTimeout(() => {
        this.buildLinesDaysOfWeek();
      }, 100);

      this.updateChart();
      if (zoomActif) {
        this.onZoom = true;
      }

      this.daysOfWeek = document.getElementsByClassName('days_of_week');
    });

    weekButton?.addEventListener('click', () => {
      console.log('Range : last week');
      let zoomActif = false;
      if (this.onZoom) {
        zoomActif = true;
        this.onZoom = false; // so we can update
      }


      const dayOfWeek = new Date(this.dataSumDbExt[this.dataSumDbExt.length - 1].date).getDay();
      this.dataSumDbExtCo2TimeSerieFiltered = this.dataSumDbExt.filter(d => new Date(d.date).getDate() > (this.currentSelectedDayOfMonth - dayOfWeek) && new Date(d.date).getMonth() === this.currentSelectedMonth);


      weekButton.className = 'btn-graph activated';
      if (allButton) {
        allButton.className = 'btn-graph';
      }
      if (dayButton) {
        dayButton.className = 'btn-graph';
      }
      if (monthButton) {
        monthButton.className = 'btn-graph';
      }

      this.removeLinesDaysOfWeek();
      this.updateChart();
      if (zoomActif) {
        this.onZoom = true;
      }
    });

    monthButton?.addEventListener('click', () => {
      console.log('Range : last month');
      let zoomActif = false;
      if (this.onZoom) {
        zoomActif = true;
        this.onZoom = false; // so we can update
      }

      const dayOfMonth = new Date(this.dataSumDbExt[this.dataSumDbExt.length - 1].date).getDate();
      this.dataSumDbExtCo2TimeSerieFiltered = this.dataSumDbExt.filter(d => new Date(d.date).getDate() > (new Date().getDate() - dayOfMonth) && new Date(d.date).getMonth() === new Date().getMonth());

      monthButton.className = 'btn-graph activated';
      if (allButton) {
        allButton.className = 'btn-graph';
      }
      if (dayButton) {
        dayButton.className = 'btn-graph';
      }
      if (weekButton) {
        weekButton.className = 'btn-graph';
      }
      this.removeLinesDaysOfWeek();
      this.updateChart();
      if (zoomActif) {
        this.onZoom = true;
      }
    });

    allButton?.addEventListener('click', () => {
      console.log('Range : all');
      let zoomActif = false;
      if (this.onZoom) {
        zoomActif = true;
        this.onZoom = false; // so we can update
      }
      this.dataSumDbExtCo2TimeSerieFiltered = [];
      allButton.className = 'btn-graph activated';     
      // this.fillIndicators(); //TODO: check impact
      if (dayButton) {
        dayButton.className = 'btn-graph';
      }
      if (weekButton) {
        weekButton.className = 'btn-graph';
      }
      if (monthButton) {
        monthButton.className = 'btn-graph';
      }

      this.removeLinesDaysOfWeek();
      this.updateChart();
      if (zoomActif) {
        this.onZoom = true;
      }
    });

    const date_filters = document.getElementById('filters');
    const buttons = date_filters?.getElementsByTagName('button');
    const rightButtonDay = document.getElementById('right-button-day');
    const leftButtonDay = document.getElementById('left-button-day');

    if (rightButtonDay && leftButtonDay) {
      (rightButtonDay as HTMLInputElement).disabled = true;
      rightButtonDay.style.opacity = '0.3';
      (leftButtonDay as HTMLInputElement).disabled = true;
      leftButtonDay.style.opacity = '0.3';
    }

    Array.from(buttons as any).forEach((button: any) => {
      (button as HTMLInputElement).addEventListener(('click'), () => {
        if ((button as HTMLInputElement).id === 'left-button-day') {
          const newDate = new Date(this.currentSelectedYear, this.currentSelectedMonth, this.currentSelectedDayOfMonth).getTime() - 3600000 * 24; // remove 1 day;
          this.currentSelectedDayOfWeek = new Date(newDate).getDay();
          this.currentSelectedDayOfMonth = new Date(newDate).getDate();
          this.currentSelectedMonth = new Date(newDate).getMonth();
          this.currentSelectedYear = new Date(newDate).getFullYear();

        } else if ((button as HTMLInputElement).id === 'right-button-day') {
          const newDate = new Date(this.currentSelectedYear, this.currentSelectedMonth, this.currentSelectedDayOfMonth).getTime() + 3600000 * 24; // add 1 day;
          this.currentSelectedDayOfWeek = new Date(newDate).getDay();
          this.currentSelectedDayOfMonth = new Date(newDate).getDate();
          this.currentSelectedMonth = new Date(newDate).getMonth();
          this.currentSelectedYear = new Date(newDate).getFullYear();
        } else {
          return;
        }

        if (this.currentSelectedDayOfMonth === new Date().getDate() && this.currentSelectedMonth === new Date().getMonth() && this.currentSelectedYear === new Date().getFullYear() && rightButtonDay) {
          (rightButtonDay as HTMLInputElement).disabled = true;
          rightButtonDay.style.opacity = '0.3';
        } else if (rightButtonDay) {
          (rightButtonDay as HTMLInputElement).disabled = false;
          rightButtonDay.style.opacity = '1';        
        }

        if (this.currentSelectedDayOfMonth === new Date(this.dataSumDbExt[0].date).getDate() && this.currentSelectedMonth === new Date(this.dataSumDbExt[0].date).getMonth() && this.currentSelectedYear === new Date(this.dataSumDbExt[0].date).getFullYear() && leftButtonDay) {
          (leftButtonDay as HTMLInputElement).disabled = true;
          leftButtonDay.style.opacity = '0.3';
        } else if (leftButtonDay) {
          (leftButtonDay as HTMLInputElement).disabled = false;
          leftButtonDay.style.opacity = '1';        
        }

        this.dataSumDbExtCo2TimeSerieFiltered = this.dataSumDbExt.filter(d => new Date(d.date).getDate() === this.currentSelectedDayOfMonth && new Date(d.date).getMonth() === this.currentSelectedMonth && new Date(d.date).getFullYear() === this.currentSelectedYear);

        const selectedDate = new Date(this.currentSelectedYear, this.currentSelectedMonth, this.currentSelectedDayOfMonth);
        let displayedDay: number;
        displayedDay = this.currentSelectedDayOfWeek % 7; // sunday is 0 and monday to 1 so we take the rest
        if (displayedDay === 0) {
          displayedDay = 7;
        }
        let j = 0;
        Array.from(this.daysOfWeek).forEach((day: any) => {
          j++;
          if ((j > new Date().getDay() % 7 && day && this.graphService.getWeek(new Date()) === this.graphService.getWeek(selectedDate)) || this.dataSumDbExtCo2TimeSerieFiltered.length === 0) {
            ((day as HTMLInputElement).nextSibling as  HTMLElement).style.opacity = '0.5';
            (day as HTMLInputElement).disabled = true;
          } else {
            ((day as HTMLInputElement).nextSibling as  HTMLElement).style.opacity = '1';
            (day as HTMLInputElement).disabled = false;
          }
        });

        if (this.daysOfWeek && this.daysOfWeek.length > 0) {
          for (let i = 0; i < this.daysOfWeek.length; i++) {
            (this.daysOfWeek[i] as HTMLInputElement).checked = false;
            if (i+1 === displayedDay) {
              (this.daysOfWeek[i] as HTMLInputElement).checked = true;   
            }
          }
        }

        if (!this.dataSumDbExtCo2TimeSerieFiltered || this.dataSumDbExtCo2TimeSerieFiltered.length === 0) {
          this.toastService.handleToast(toastType.Info, 'Pas de donnée enregistrée disponible pour ce jour');
          return;
        }

        this.removeLinesDaysOfWeek();
        this.updateChart();
      });
    });
  }

  private removeLinesDaysOfWeek() {
    for (let i = 0; i < 7; i++) {
      let line = d3.select('.line.' + this.dayOfWeekNames[i]);
      let label = d3.select('.line_label_' + this.dayOfWeekNames[i]);
      if (line && label) {
        line.remove();
        label.remove();
        this.linesDaysOfWeek = this.linesDaysOfWeek.filter((line) => line.name !== this.dayOfWeekNames[i]);
      }
    }
  }

  private buildLinesDaysOfWeek() {
    let linesColor = ['#f87171', '#94a3b8', '#a3e635', '#22d3ee', '#818cf8', '#c084fc', '#fb7185'];
    let displayedDay: number;
    displayedDay = this.currentSelectedDayOfWeek % 7; // sunday is 0 and monday to 1 so we take the rest
    if (displayedDay === 0) {
      displayedDay = 7;
    }

    if (this.daysOfWeek && this.daysOfWeek.length > 0) {
      for (let i = 0; i < this.daysOfWeek.length; i++) {
        if (i+1 === displayedDay) {
          (this.daysOfWeek[i] as HTMLInputElement).checked = true;    
          let j = 0;
          Array.from(this.daysOfWeek).forEach((day: any) => {
            j++;
            if (j > displayedDay && day) {
              ((day as HTMLInputElement).nextSibling as  HTMLElement).style.opacity = '0.5';
              (day as HTMLInputElement).disabled = true;
            }
          });
        }
        this.daysOfWeek[i].addEventListener('click', (e) => {

          let displayedDay: number;
          displayedDay = this.currentSelectedDayOfWeek % 7; // sunday is 0 and monday to 1 so we take the rest
          if (displayedDay === 0) {
            displayedDay = 7;
          }
          let line = d3.select('.line.' + this.dayOfWeekNames[i]);
          let label = d3.select('.line_label_' + this.dayOfWeekNames[i]);
          console.log('.line.' + this.dayOfWeekNames[i]);

          if (!((this.daysOfWeek[i] as HTMLInputElement).checked)) { // when checked
            if (line) {
              if (i+1 === displayedDay) {
                line = d3.select('.line.line1');
                d3.select('.circle_line1').style('opacity', '0');
                d3.select('.image_line1').style('opacity', '0');
              }
              line.style('opacity', '0');
              label.style('opacity', '0');
              this.linesDaysOfWeek = this.linesDaysOfWeek.filter((line) => line.name !== this.dayOfWeekNames[i]);
              this.updateChart();
              return;
            }
            
            return;
          }

          console.log('Cliked day ' + ( i + 1));
          console.log('Displayed day : ' + displayedDay);
          let zoomActif = false;
          if (this.onZoom) {
            zoomActif = true;
            this.onZoom = false; // so we can update
          }

          let valueLineExists = false;

          // We check that we don't have already drawn this line before
          this.valueslines.forEach((el: Line) => {
            this.linesDaysOfWeek.forEach((line) => {
              if (el.name === this.dayOfWeekNames[i] && line.name === el.name) {
                this.linesDaysOfWeek.push(el);
                valueLineExists = true; // we set this variable cause the steps with return just bellow doesn't work in loop
              }
            })

          });
          if (valueLineExists || i+1 === displayedDay) {
            if (i+1 === displayedDay) {
              line = d3.select('.line.line1');
              d3.select('.circle_line1').style('opacity', '1');
              d3.select('.image_line1').style('opacity', '1');
            } else {
              label.style('opacity', '1');
            }
              line.style('opacity', '1');
            this.updateChart();
            return;
          }

          const selectedDate = new Date(this.currentSelectedYear, this.currentSelectedMonth, this.currentSelectedDayOfMonth);
          console.log(selectedDate);
  
          const dataDayOfWeek = this.dataDb.filter(d => new Date(d.date).getDay() % 7 === (i + 1) % 7 && this.graphService.getWeek(new Date(d.date)) === this.graphService.getWeek(selectedDate) && new Date(d.date).getFullYear() === this.currentSelectedYear);

          // We need to adjuste the dates so they all start from the same point so we can compare them without rescaling
          if (!dataDayOfWeek || dataDayOfWeek.length === 0) {
            this.toastService.handleToast(toastType.Info, 'Pas de donnée enregistrée disponible pour ce jour');
            e.preventDefault();
            return;
          }

          const deltaDate = 3600000 * 24 * (displayedDay - (i + 1)); // 3.6e6 = 1 hour
          const deltaCo2 = this.dataSumDbExtCo2TimeSerieFiltered[0].co2 - dataDayOfWeek[0].co2;

          let newData: Co2ByOriginByTime[] = [];
          dataDayOfWeek.forEach((point) => {
            const date = new Date(point.date).getTime() + deltaDate;
            const co2 = point.co2 + deltaCo2;
            newData.push({date: new Date(date), co2: co2});
          });
  
          // Add new line if valueslines contains the main lines already
          if (this.valueslines && this.valueslines.length > 2 && newData && newData.length > 0) {
            const dayLine: Line = new Line(this.dayOfWeekNames[i], newData, this.chartProps.x, this.chartProps.y, linesColor[i]);
            dayLine.addToPath(this.glines);
            dayLine.addLineLabel(this.chartProps);

            this.linesDaysOfWeek.push(dayLine);
            this.valueslines.push(dayLine);
          }

          this.updateChart();
    
          if (zoomActif) {
            this.onZoom = true;
          }
        });
      }
    }
  }

  private buildChart() {
    console.log('i bluid chart');

    const no_data_overlay = document.getElementById('no_data');
    if (no_data_overlay) {
      no_data_overlay.style.display = 'none';
    }

    this.chartProps = {};
    
    this.dataDrawnCo2TimeSerie = this.graphService.reducePointsCo2TimeSerie(this.dataSumDbExt);
    console.log(this.dataDrawnCo2TimeSerie);
    // propage 
    this.graphService.$dataDrawnCo2TimeSerie.next(this.dataDrawnCo2TimeSerie);

    // Set the dimensions of the graph
    const margin = { top: 30, right: 20, bottom: 40, left: 50 };
    let width = 1244  - margin.left - margin.right;
    let height = 651  - margin.top - margin.bottom;

    const widthDivChart = document.getElementById('chart')?.clientWidth;
    const heightDivChart = document.getElementById('chart')?.clientHeight;
    if (widthDivChart && heightDivChart) {
      width = widthDivChart - margin.left - margin.right;
      height = heightDivChart - margin.top - margin.bottom;
    }
    
    const svg = d3.select(this.chartElement.nativeElement)
      .append('svg')
      // .attr('width', width + margin.left + margin.right)
      // .attr('height', height + margin.top + margin.bottom)
      .attr('viewBox', '0 0 ' + ( width + margin.left + margin.right)  + ' ' + (height + margin.top + margin.bottom));
      const svgBox = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Set the ranges
    this.chartProps.x = d3.scaleTime().range([0, width]);
    this.chartProps.y = d3.scaleLinear().range([height, 0]);

    // Define the axes
    const xAxis = (g: any, x: any) => g
    .call(d3.axisBottom(x).ticks(5).tickFormat(this.graphService.multiFormat).tickPadding(width / 80));
    var yAxis = (g: any, y: any) => g
    .call(d3.axisLeft(y).ticks(5).tickPadding(height / 80).tickSize(-15000));
  
    this.graphService.scaleXYDomain(this.dataDrawnCo2TimeSerie, this.chartProps.x, this.chartProps.y);
  
    // Add lines group
    this.glines = svgBox.append("g").attr("id", "lines");

    /// DRAW GLOBAL MEAN LINE
    if (this.dataGlobal && this.dataGlobal.length > 0) {
      this.dataGlobal = this.graphService.reducePointsCo2TimeSerie(this.dataGlobal);
      this.globalLine = new Line('line_global_mean', this.dataGlobal,
      this.chartProps.x, this.chartProps.y, 'grey', d3.curveBundle.beta(0.40)); // define the line
      this.globalLine.addToPath(this.glines); // add to path
      this.valueslines.push(this.globalLine);
    }

    // Add first line 
    this.mainLine = new Line('line' + this.valueslines.length, this.dataDrawnCo2TimeSerie, this.chartProps.x, this.chartProps.y, 'orange'); // create ligne
    this.mainLine.addToPath(this.glines); // add to path

    this.valueslines.push(this.mainLine);

    // Add the X Axis
    const gx = svgBox.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis, this.chartProps.x);

    this.chartProps.height = height;
    this.chartProps.width = width;

    svgBox.append('image')
    .attr("class", "arrow")
    .attr('xlink:href', "assets/arrow.png")
    .attr('width', 14)
    .attr('height', 14)
    .attr('x', this.chartProps.width - 5)
    .attr('opacity', '1')
    .attr('y', this.chartProps.height - 7);

    // Add the Y Axis
    const gy = svgBox.append('g')
      .attr('class', 'y axis')
      .call(yAxis, this.chartProps.y);

      gy.selectAll(".tick line").style("stroke-dasharray", "5 5").style("opacity", "0.3");
      // gx.select('path').style("opacity", "0");
      gy.select('path').style("opacity", "0");

    // Setting the required objects in chartProps so they could be used to update the chart
    this.chartProps.svg = svg;
    this.chartProps.svgBox = svgBox;
    this.chartProps.xAxis = xAxis;
    this.chartProps.yAxis = yAxis;
    this.chartProps.margin = margin;

    // Label for Y axis
    svg.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "middle")
    .attr("x", 100)
    .attr("y", this.chartProps.height / 2)
    .style("font-size", "12px")
    .attr("dy", ".75em")
    .text("Co2(grammes)");

    // // Add treashold internet line
    this.dataThreshold = [{co2: this.thresholdCo2, date: this.dataDrawnCo2TimeSerie[0].date}, {co2: this.thresholdCo2, date: this.dataDrawnCo2TimeSerie[this.dataDrawnCo2TimeSerie.length - 1].date}];
    console.log(this.thresholdCo2);
    let valueline_threshold_internet: Line = new Line('Seuil', this.dataThreshold, this.chartProps.x, this.chartProps.y, 'red'); // create ligne
    valueline_threshold_internet.addToPath(this.glines); // add to path

    this.valueslines.push(valueline_threshold_internet);

    // ZOOM
    this.zoom = d3.zoom()
    .on('zoom', (event) => this.graphService.chartZoom(event, this.chartProps, gx, gy, xAxis, yAxis, this.valueslines))
    .scaleExtent([1, 20]);

    // TOOLTIP
    this.graphService.buildTooltip(this.chartProps);

    // Add avatars for each Lines
    this.valueslines.forEach(line => {
      line.buildAvatar(this.chartProps);
      line.updateAvatarPosition(this.chartProps);
      line.addLineLabel(this.chartProps, (line.data[line.data.length - 1].co2 / 1000).toFixed(1) + ' kgCo2e');
    });


    // by default we hide global data : 
    this.globalLine.hide();

    // hide threshold internet too
    valueline_threshold_internet.hide();

    this.updateChart();

    // We want the day button activated by default
    const lastDayButton = document.getElementById('day');
    (lastDayButton as HTMLInputElement).click();
  }

  private updateChart() {
    console.log('update chart');
    if (this.onZoom) {
      return;
    }

    // which data to draw 
    if (this.dataSumDbExtCo2TimeSerieFiltered && this.dataSumDbExtCo2TimeSerieFiltered.length > 0) {
      this.dataDrawnCo2TimeSerie = [...this.dataSumDbExtCo2TimeSerieFiltered];
    }
    else if (this.dataDb && this.dataDb.length > 0) {
      this.dataDrawnCo2TimeSerie = [...this.dataDb];
    } else {
      this.dataDrawnCo2TimeSerie = [];
    }

    if (this.currentSelectedDayOfMonth === new Date().getDate() && this.currentSelectedMonth === new Date().getMonth() && this.currentSelectedYear === new Date().getFullYear()) {
      this.firstDataExt.forEach((entry) => {  // fill with data extension stored when you were not on the website
        this.dataDrawnCo2TimeSerie.push(entry);
      });

      this.dataDrawnCo2TimeSerie = this.graphService.reducePointsCo2TimeSerie(this.dataDrawnCo2TimeSerie);

      this.dataExt.forEach((entry) => {
        this.dataDrawnCo2TimeSerie.push(entry);
      });
    } else {
      this.dataDrawnCo2TimeSerie = this.graphService.reducePointsCo2TimeSerie(this.dataDrawnCo2TimeSerie);
    }

    // propage 
    this.graphService.$dataDrawnCo2TimeSerie.next(this.dataDrawnCo2TimeSerie);

  
    const GESgCO2ForOneKmByCar = 220;
    const GESgCO2ForOneChargedSmartphone = 8.3;
    let gCO2Total = (this.dataDrawnCo2TimeSerie[this.dataDrawnCo2TimeSerie.length - 1].co2 / 1000);
    const co2_internet = document.getElementById('co2_internet');
    if (co2_internet && this.dataDrawnCo2TimeSerie.length > 0) {
      co2_internet.innerHTML = gCO2Total.toFixed(1) + ' kgCo<sub>2</sub>e';
    }
    const co2_internet_resume = document.getElementById('co2_internet_resume');
    if (co2_internet_resume && gCO2Total > 0) {
      co2_internet_resume.innerHTML = 'Vous avez émis ' + gCO2Total.toFixed(1) + ' kgCo<sub>2</sub>e ';
    }
    const kmByCar_max = document.getElementById('kmByCar_max');
    if (kmByCar_max) {
      const kmByCar = Math.round(1000 * gCO2Total / GESgCO2ForOneKmByCar);
      kmByCar_max.innerHTML = kmByCar.toFixed(1) + ' Km';

    }
    const chargedSmartphones_max = document.getElementById('chargedSmartphones_max');
    if (chargedSmartphones_max) {
      const chargedSmartphones = Math.round(gCO2Total / GESgCO2ForOneChargedSmartphone * 1000);
      chargedSmartphones_max.innerHTML = chargedSmartphones.toFixed(0) + ' recharges';
    }

    // Update mainLine data
    this.mainLine.data = this.dataDrawnCo2TimeSerie;

    // define the right threashold according to time filter and level
    let threshold;
    if (this.userFeatures && this.userFeatures.level && this.userFeatures.internet) {
      switch(this.userFeatures.level) {
        case 'debutant':
          this.tonnes = 6;
          this.degres = 3.5;
          threshold = Math.trunc((this.tonnes * 1000000) / 365) * 4 / 100;
          break;
        case 'apprenti':
          this.tonnes = 5;
          this.degres = 3;
          threshold = Math.trunc((this.tonnes * 1000000) / 365) * 4 / 100;
          break;
        default:
          this.tonnes = 2;
          this.degres = 1.5;
          threshold = Math.trunc((this.tonnes * 1000000) / 365) * 4 / 100;
          break;
      }
    } else {
      threshold = 275;
    }
    console.log(threshold);
    let diff_between_dataDrawn_minmax_date = this.dataDrawnCo2TimeSerie[this.dataDrawnCo2TimeSerie.length - 1].date - this.dataDrawnCo2TimeSerie[0].date;
    diff_between_dataDrawn_minmax_date /= (3.6e+6); // heures
    if (diff_between_dataDrawn_minmax_date < 24 && threshold) {
      this.thresholdCo2 = this.dataDrawnCo2TimeSerie[0].co2 + threshold;
    } else if (diff_between_dataDrawn_minmax_date >= 24 && diff_between_dataDrawn_minmax_date < 24*7 && threshold) {
      this.thresholdCo2 = this.dataDrawnCo2TimeSerie[0].co2 + threshold * 7;
    } else if (diff_between_dataDrawn_minmax_date >= 24*7 && diff_between_dataDrawn_minmax_date < 24*31 && threshold) {
      this.thresholdCo2 = this.dataDrawnCo2TimeSerie[0].co2 + threshold * 30;
    } else {
      this.thresholdCo2 = 100000;
    }
    console.log(this.thresholdCo2);
    this.dataThreshold = [{co2: this.thresholdCo2, date: this.dataDrawnCo2TimeSerie[0].date}, {co2: this.thresholdCo2, date: this.dataDrawnCo2TimeSerie[this.dataDrawnCo2TimeSerie.length - 1].date}];

    // update threshold data
    this.valueslines[2].data = this.dataThreshold;

    // SCALE ACCORDING TO UPDATED RANGE
    let sumAllData: Co2ByOriginByTime[] = [];
    const treasholdButton = document.getElementById('treashold');
    const globalDataButton = document.getElementById('global_data');
    if (treasholdButton?.className.includes('activated')) {
      sumAllData = [...this.dataThreshold];
    }
    // if (globalDataButton?.className.includes('activated')) {
    //   this.dataGlobal.forEach((data) => {
    //     sumAllData.push(data);
    //   });
    // }
    this.dataDrawnCo2TimeSerie.forEach((data) => {
      sumAllData.push(data);
    });
    this.linesDaysOfWeek.forEach((line) => {
        line.data.forEach((datas) => {
          sumAllData.push(datas);
        })
    });
    this.graphService.scaleXYDomain(sumAllData, this.chartProps.x, this.chartProps.y);

    ////// DRAW MULTIPLE LINES FOR EACH CATEGORY  AS ONE CONTINUE LINE 
    // let lastOriginValue = this.dataDrawnCo2TimeSerie[this.dataDrawnCo2TimeSerie.length - 1].origin;

    // if (lastOriginValue && this.currentOrigin && this.dataDrawnCo2TimeSerie && this.currentOrigin !== lastOriginValue) { // if different origin
    //   console.log('New Line');
    //   this.valueslines[this.valueslines.length - 1].data = [...this.valueslines[this.valueslines.length - 1].data]; // Deep copy of current line data
    //   this.selectedColor = this.listColors[Math.trunc(Math.random() * 4)];
    //   // Add new line
    //   this.currentOrigin = lastOriginValue;
    //   const valueline: Line = new Line('line' + this.valueslines.length, [], this.chartProps.x, this.chartProps.y, this.selectedColor, this.currentOrigin); // define the line
    //   valueline.addToPath(this.glines); // add to path

    //   this.valueslines.push(valueline);
    // } else if (this.valueslines.length > 1) {
    //   this.valueslines[this.valueslines.length - 1].data = [...this.dataDrawnCo2TimeSerie.slice(this.getIndexNewLine())];
    // }

    // update all lines : 
    this.valueslines.forEach( (line: Line) => {
      if (line.name == 'line_global_mean') {
        line.update(this.chartProps.svgBox, this.chartProps.x, this.chartProps.y, d3.curveBundle.beta(0.40));
      } else {
        line.update(this.chartProps.svgBox, this.chartProps.x, this.chartProps.y);
      }
      if (line.getLineLastPointPos(this.chartProps)) {
        line.updateAvatarPosition(this.chartProps);
        if (line.name === 'line1' || line.name === 'Seuil' || line.name == 'line_global_mean') {
          line.updateLabel(this.chartProps, this.chartProps.x, this.chartProps.y, (line.data[line.data.length - 1].co2 / 1000).toFixed(1) + ' kgCo2e');
        } else {
          line.updateLabel(this.chartProps);
        }
      }
    });

    console.log(this.valueslines);

    // updateThresholdLabel Position
    this.valueslines[2].getLineLastPointPos(this.chartProps);

    this.chartProps.svgBox.transition();

    this.chartProps.svgBox.select('.x.axis') // update x axis
    .call(this.chartProps.xAxis, this.chartProps.x);

    this.chartProps.svgBox.select('.y.axis') // update y axis
      .call(this.chartProps.yAxis, this.chartProps.y);

    this.chartProps.svgBox.selectAll(".tick line").style("stroke-dasharray", "5 5").style("opacity", "0.3");

    // SET BANNER TIME RANGE
    const time_range = document.getElementById('time_range');
    if (time_range) {
      let start_date = new Date(this.dataDrawnCo2TimeSerie[0].date);
      let end_date = new Date(this.dataDrawnCo2TimeSerie[this.dataDrawnCo2TimeSerie.length - 1].date);
      // TODO: issue with month, i have to add 1
      time_range.innerHTML = start_date.getDate() + '/' + (start_date.getMonth() + 1) + '/' + start_date.getFullYear() + ' - Aujourd\'hui'

      if (start_date.getDate() === end_date.getDate() && 
      start_date.getMonth() === end_date.getMonth()) {
        const formatDate = this.graphService.d3Locale.format("%A %d %B");
        time_range.innerHTML = formatDate(start_date);
      }
    }


  }

  public isDayButtonActivated(): boolean {
    const hideButton = document.getElementById('hide');
    const showButton = document.getElementById('show');
    const  dayButton = document.getElementById('day');
    if (dayButton?.className.includes('activated') && hideButton) {
      return true;
    } else {
      return false;
    }
  }

  public zoomTransform(): void {
    this.chartProps.svgBox.transition()
      .duration(750)
      .call(this.zoom.transform, d3.zoomIdentity);
  }
}
