import { Component } from "@angular/core";

//Skeleton component 
//Routed as a child of ProjectDetailComponent via lazy loading

@Component({
    selector: 'app-profitability',
    standalone: true,
    template: `
      <div class="step-container">
       <h2>Profitability</h2>
       <p>Coming Soon...</p>
    </div>
    `,
    styles: [`
            .step-container { padding: 2rem; }
            h2 { color: #333; margin-bottom: 1rem; }
        `]

})

export class ProfitabilityComponent {}