import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
const googleNewsScraper = require('google-news-scraper');

@Injectable()
export class NewsCrawlerService {
  constructor(private readonly prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleCron() {
    const articles = await googleNewsScraper({
      searchTerm: 'tennis',
      getArticleContent: true,
      queryVars: {
        hl: 'en-US',
        gl: 'US',
        ceid: 'US:en',
      },
      timeframe: '2h',
    });
    const news = (
      await Promise.all(
        articles.map(async (article) => {
          if (
            (article.title.includes('tennis') ||
              article.content.includes('tennis')) &&
            article.content.length > 2000
          ) {
            let articleDescription = article.content.split('\n')[0] + '...';
            if (articleDescription.length > 1000) {
              articleDescription = articleDescription.slice(0, 500) + '...';
            }
            const authors = ['Robert', 'John', 'Emily', 'David', 'Sarah'];
            const randomIndex = Math.floor(Math.random() * authors.length);
            const author = authors[randomIndex];
            const imgUrl = await this.getFinalImageUrl(article.image);
            return {
              image: imgUrl,
              title: article.title,
              description: articleDescription,
              content: article.content,
              createdAt: article.datetime,
              author: author,
            };
          }
        }),
      )
    ).filter(Boolean);
    await this.prismaService.news.createMany({
      data: news,
    });
  }

  async getFinalImageUrl(originalUrl: string): Promise<string> {
    try {
      const response = await axios.get(originalUrl); // Perform a HEAD request to avoid downloading the entire response body
      const finalUrl = response.request.res.responseUrl;
      return finalUrl;
    } catch (error) {
      console.error('Error fetching final URL:', error);
      throw error;
    }
  }
}
