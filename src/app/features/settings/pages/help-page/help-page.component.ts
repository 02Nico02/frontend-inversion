import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help-page.component.html',
  styleUrls: ['./help-page.component.scss'],
})
export class HelpPageComponent {
  constructor(public readonly privacyMode: PrivacyModeService) {}

  togglePrivacy(): void {
    this.privacyMode.toggle();
  }
}
