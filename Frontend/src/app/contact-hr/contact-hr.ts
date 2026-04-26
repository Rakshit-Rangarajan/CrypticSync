import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-contact-hr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-hr.html',
  styleUrl: './contact-hr.css',
})
export class ContactHrComponent {
  subject = '';
  message = '';

  constructor(private router: Router) {}

  sendMessage() {
    if (this.subject && this.message) {
      alert('Message sent successfully! HR will respond within 24 hours.');
      this.subject = '';
      this.message = '';
      this.router.navigate(['/dashboard']);
    }
  }
}