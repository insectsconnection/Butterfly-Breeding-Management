import pandas as pd
import datetime as dt
from datetime import datetime, timedelta
import json
import os
from twilio_service import send_batch_notification

class DataManager:
    def __init__(self):
        self.batches_file = "larval_batches.json"
        self.log_file = "feeding_log.json"
        self.batches_data = self.load_batches()
        self.feeding_log = self.load_feeding_log()
    
    def load_batches(self) -> list:
        """Load batch data from JSON file"""
        if os.path.exists(self.batches_file):
            try:
                with open(self.batches_file, 'r') as f:
                    data = json.load(f)
                # Convert string dates back to datetime objects
                for batch in data:
                    batch['start_date'] = datetime.fromisoformat(batch['start_date'])
                    batch['next_feeding'] = datetime.fromisoformat(batch['next_feeding'])
                return data
            except Exception as e:
                print(f"Error loading batches: {e}")
                return []
        return []
    
    def save_batches(self):
        """Save batch data to JSON file"""
        try:
            # Convert datetime objects to strings for JSON serialization
            serializable_data = []
            for batch in self.batches_data:
                batch_copy = batch.copy()
                batch_copy['start_date'] = batch['start_date'].isoformat()
                batch_copy['next_feeding'] = batch['next_feeding'].isoformat()
                serializable_data.append(batch_copy)
            
            with open(self.batches_file, 'w') as f:
                json.dump(serializable_data, f, indent=2)
        except Exception as e:
            print(f"Error saving batches: {e}")
    
    def load_feeding_log(self) -> list:
        """Load feeding log from JSON file"""
        if os.path.exists(self.log_file):
            try:
                with open(self.log_file, 'r') as f:
                    data = json.load(f)
                # Convert string timestamps back to datetime objects
                for entry in data:
                    entry['timestamp'] = datetime.fromisoformat(entry['timestamp'])
                return data
            except Exception as e:
                print(f"Error loading feeding log: {e}")
                return []
        return []
    
    def save_feeding_log(self):
        """Save feeding log to JSON file"""
        try:
            # Convert datetime objects to strings for JSON serialization
            serializable_data = []
            for entry in self.feeding_log:
                entry_copy = entry.copy()
                entry_copy['timestamp'] = entry['timestamp'].isoformat()
                serializable_data.append(entry_copy)
            
            with open(self.log_file, 'w') as f:
                json.dump(serializable_data, f, indent=2)
        except Exception as e:
            print(f"Error saving feeding log: {e}")
    
    def add_batch(self, batch_id: str, species: str, larval_count: int, phone_number: str,
                  start_date: datetime, feeding_interval: int, notes: str, next_feeding: datetime) -> bool:
        """Add a new larval batch"""
        try:
            # Check if batch_id already exists
            if any(batch['batch_id'] == batch_id for batch in self.batches_data):
                return False
            
            new_batch = {
                'batch_id': batch_id,
                'species': species,
                'larval_count': larval_count,
                'phone_number': phone_number,
                'start_date': start_date,
                'feeding_interval': feeding_interval,
                'notes': notes,
                'next_feeding': next_feeding,
                'status': 'active',
                'total_feedings': 0
            }
            
            self.batches_data.append(new_batch)
            self.save_batches()
            return True
        except Exception as e:
            print(f"Error adding batch: {e}")
            return False
    
    def get_active_batches(self) -> pd.DataFrame:
        """Get all active batches as DataFrame"""
        active_batches = [batch for batch in self.batches_data if batch['status'] == 'active']
        if not active_batches:
            return pd.DataFrame()
        
        df = pd.DataFrame(active_batches)
        # Sort by next feeding time (most urgent first)
        df = df.sort_values('next_feeding')
        return df
    
    def mark_as_fed(self, batch_id: str):
        """Mark a batch as fed and update next feeding time"""
        for batch in self.batches_data:
            if batch['batch_id'] == batch_id:
                # Update next feeding time
                batch['next_feeding'] = datetime.now() + timedelta(days=batch['feeding_interval'])
                batch['total_feedings'] += 1
                
                # Log the feeding activity
                self.log_feeding_activity(batch_id, f"Batch fed (Total feedings: {batch['total_feedings']})")
                
                self.save_batches()
                break
    
    def log_feeding_activity(self, batch_id: str, activity: str):
        """Log a feeding activity"""
        log_entry = {
            'timestamp': datetime.now(),
            'batch_id': batch_id,
            'activity': activity
        }
        
        self.feeding_log.append(log_entry)
        self.save_feeding_log()
    
    def get_feeding_log(self) -> pd.DataFrame:
        """Get feeding log as DataFrame"""
        if not self.feeding_log:
            return pd.DataFrame()
        
        df = pd.DataFrame(self.feeding_log)
        # Sort by timestamp (most recent first)
        df = df.sort_values('timestamp', ascending=False)
        return df
    
    def check_and_send_notifications(self):
        """Check for batches that need feeding and send notifications"""
        current_time = datetime.now()
        
        for batch in self.batches_data:
            if batch['status'] != 'active':
                continue
            
            time_since_feeding = current_time - batch['next_feeding']
            
            # Send notification if feeding is overdue by more than 1 hour
            if time_since_feeding.total_seconds() > 3600:  # 1 hour
                overdue_hours = int(time_since_feeding.total_seconds() // 3600)
                
                # Check if we've already sent a notification recently (within last 4 hours)
                recent_notifications = [
                    entry for entry in self.feeding_log
                    if entry['batch_id'] == batch['batch_id'] 
                    and 'notification sent' in entry['activity'].lower()
                    and (current_time - entry['timestamp']).total_seconds() < 14400  # 4 hours
                ]
                
                if not recent_notifications:
                    success = send_batch_notification(batch, overdue_hours)
                    if success:
                        self.log_feeding_activity(
                            batch['batch_id'], 
                            f"Automatic notification sent (overdue by {overdue_hours}h)"
                        )
    
    def clear_completed_batches(self) -> int:
        """Remove completed/inactive batches"""
        initial_count = len(self.batches_data)
        self.batches_data = [batch for batch in self.batches_data if batch['status'] == 'active']
        self.save_batches()
        return initial_count - len(self.batches_data)
    
    def export_to_csv(self) -> str:
        """Export all data to CSV format"""
        try:
            # Combine batch data and feeding log
            batches_df = pd.DataFrame(self.batches_data)
            log_df = pd.DataFrame(self.feeding_log)
            
            # Convert to CSV strings
            batches_csv = batches_df.to_csv(index=False)
            log_csv = log_df.to_csv(index=False)
            
            combined_csv = "LARVAL BATCHES\n" + batches_csv + "\n\nFEEDING LOG\n" + log_csv
            return combined_csv
        except Exception as e:
            print(f"Error exporting to CSV: {e}")
            return "Error exporting data"
    
    def complete_batch(self, batch_id: str):
        """Mark a batch as completed"""
        for batch in self.batches_data:
            if batch['batch_id'] == batch_id:
                batch['status'] = 'completed'
                self.log_feeding_activity(batch_id, "Batch marked as completed")
                self.save_batches()
                break
