import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
const NewsAPI = require('newsapi');

@Injectable()
export class NewsCrawlerService {
  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleCron() {
    const newsapi = new NewsAPI(process.env.NEWS_API_KEY);
    const now = new Date();
    const toDate = now.toISOString();
    const fromDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    newsapi.v2
      .everything({
        q: 'tennis',
        sources: 'bbc-sport',
        from: fromDate,
        to: toDate,
        language: 'en',
        page: 1,
        pageSize: 10,
      })
      .then(async (response) => {
        if (response.status === 'ok') {
          const news = (
            await Promise.all(
              response.articles.map(async (article) => {
                const author =
                  article.author || 'https://www.facebook.com/bbcnews';
                return {
                  image: article.urlToImage,
                  title: article.title,
                  description: article.description,
                  content: article.content,
                  createdAt: article.publishedAt,
                  author: author,
                };
              }),
            )
          ).filter(Boolean);
          await this.prismaService.news.createMany({
            data: news,
          });
        }
      });
  }
}
