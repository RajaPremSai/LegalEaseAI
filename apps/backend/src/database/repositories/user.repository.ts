import { User, UserProfile, UserSubscription } from '@legal-ai/shared';
import { BaseRepository } from './base.repository';

export interface CreateUserData {
  email: string;
  profile: Omit<UserProfile, 'preferences'> & { preferences?: Partial<UserProfile['preferences']> };
  subscription?: Partial<UserSubscription>;
}

export interface UpdateUserData {
  profile?: Partial<UserProfile>;
  subscription?: Partial<UserSubscription>;
}

export class UserRepository extends BaseRepository {
  async create(userData: CreateUserData): Promise<User> {
    return await this.transaction(async (client) => {
      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email) VALUES ($1) RETURNING id, email, created_at',
        [userData.email]
      );
      
      const user = userResult.rows[0];

      // Create user profile with defaults
      const profileData = {
        user_id: user.id,
        name: userData.profile.name,
        user_type: userData.profile.userType,
        jurisdiction: userData.profile.jurisdiction,
        language: userData.profile.preferences?.language || 'en',
        notifications: userData.profile.preferences?.notifications ?? true,
        auto_delete: userData.profile.preferences?.autoDelete ?? true,
      };

      await client.query(
        `INSERT INTO user_profiles (user_id, name, user_type, jurisdiction, language, notifications, auto_delete)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          profileData.user_id,
          profileData.name,
          profileData.user_type,
          profileData.jurisdiction,
          profileData.language,
          profileData.notifications,
          profileData.auto_delete,
        ]
      );

      // Create user subscription with defaults
      const subscriptionData = {
        user_id: user.id,
        plan: userData.subscription?.plan || 'free',
        documents_remaining: userData.subscription?.documentsRemaining || 5,
        renews_at: userData.subscription?.renewsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      await client.query(
        'INSERT INTO user_subscriptions (user_id, plan, documents_remaining, renews_at) VALUES ($1, $2, $3, $4)',
        [
          subscriptionData.user_id,
          subscriptionData.plan,
          subscriptionData.documents_remaining,
          subscriptionData.renews_at,
        ]
      );

      return await this.findById(user.id);
    });
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.query(
      `SELECT 
        u.id, u.email, u.created_at,
        up.name, up.user_type, up.jurisdiction, up.language, up.notifications, up.auto_delete,
        us.plan, us.documents_remaining, us.renews_at
       FROM users u
       JOIN user_profiles up ON u.id = up.user_id
       JOIN user_subscriptions us ON u.id = us.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.mapRowToUser(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query(
      `SELECT 
        u.id, u.email, u.created_at,
        up.name, up.user_type, up.jurisdiction, up.language, up.notifications, up.auto_delete,
        us.plan, us.documents_remaining, us.renews_at
       FROM users u
       JOIN user_profiles up ON u.id = up.user_id
       JOIN user_subscriptions us ON u.id = us.user_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.mapRowToUser(row);
  }

  async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    return await this.transaction(async (client) => {
      // Update profile if provided
      if (updateData.profile) {
        const profileFields: Record<string, any> = {};
        
        if (updateData.profile.name) profileFields.name = updateData.profile.name;
        if (updateData.profile.userType) profileFields.user_type = updateData.profile.userType;
        if (updateData.profile.jurisdiction) profileFields.jurisdiction = updateData.profile.jurisdiction;
        if (updateData.profile.preferences?.language) profileFields.language = updateData.profile.preferences.language;
        if (updateData.profile.preferences?.notifications !== undefined) profileFields.notifications = updateData.profile.preferences.notifications;
        if (updateData.profile.preferences?.autoDelete !== undefined) profileFields.auto_delete = updateData.profile.preferences.autoDelete;

        if (Object.keys(profileFields).length > 0) {
          const { setClause, values } = this.buildUpdateClause(profileFields);
          await client.query(
            `UPDATE user_profiles ${setClause} WHERE user_id = $${values.length + 1}`,
            [...values, id]
          );
        }
      }

      // Update subscription if provided
      if (updateData.subscription) {
        const subscriptionFields: Record<string, any> = {};
        
        if (updateData.subscription.plan) subscriptionFields.plan = updateData.subscription.plan;
        if (updateData.subscription.documentsRemaining !== undefined) subscriptionFields.documents_remaining = updateData.subscription.documentsRemaining;
        if (updateData.subscription.renewsAt) subscriptionFields.renews_at = updateData.subscription.renewsAt;

        if (Object.keys(subscriptionFields).length > 0) {
          const { setClause, values } = this.buildUpdateClause(subscriptionFields);
          await client.query(
            `UPDATE user_subscriptions ${setClause} WHERE user_id = $${values.length + 1}`,
            [...values, id]
          );
        }
      }

      return await this.findById(id);
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async decrementDocumentsRemaining(id: string): Promise<boolean> {
    const result = await this.query(
      'UPDATE user_subscriptions SET documents_remaining = documents_remaining - 1 WHERE user_id = $1 AND documents_remaining > 0',
      [id]
    );
    return result.rowCount > 0;
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      profile: {
        name: row.name,
        userType: row.user_type,
        jurisdiction: row.jurisdiction,
        preferences: {
          language: row.language,
          notifications: row.notifications,
          autoDelete: row.auto_delete,
        },
      },
      subscription: {
        plan: row.plan,
        documentsRemaining: row.documents_remaining,
        renewsAt: row.renews_at,
      },
      createdAt: row.created_at,
    };
  }
}