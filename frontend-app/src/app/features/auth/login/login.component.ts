import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule], 
  template: `
    <div class="login-container">
      <div class="login-card">

       
        <div class="login-header">
          <h1>Solar Creator</h1>
          <p>Sign in to your account</p>
        </div>

       
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">

          <div class="form-group">
            <label for="email">E-Mail</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="installer@example.com"
              [class.error]="isFieldInvalid('email')"
            />
            @if (isFieldInvalid('email')) {
              <span class="error-msg">Valid email required</span>
            }
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              [class.error]="isFieldInvalid('password')"
            />
            @if (isFieldInvalid('password')) {
              <span class="error-msg">Password required</span>
            }
          </div>

          
          @if (errorMessage) {
            <div class="alert-error">{{ errorMessage }}</div>
          }

          <button type="submit" [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>

        </form>
      </div>
    </div>
  `,
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = false;
  errorMessage = '';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    
    return !!(control?.invalid && control?.touched);
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

   
    
    try {
      await new Promise(r => setTimeout(r, 500)); 
      const mockToken = 'mock-jwt-token';
      this.authService.saveToken(mockToken);

      
      const returnUrl = new URLSearchParams(window.location.search)
        .get('returnUrl') || '/projects';
      this.router.navigateByUrl(returnUrl);
    } catch {
      this.errorMessage = 'Invalid email or password.';
    } finally {
      this.loading = false;
    }
  }
}